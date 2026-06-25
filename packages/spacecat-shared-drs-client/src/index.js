/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { hasText, instrumentAWSClient, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import { randomUUID } from 'crypto';

const EXTERNAL_SPACECAT_PROVIDER_ID = 'external_spacecat';
const DRS_S3_KEY_PREFIX = 'external/spacecat';
// XLSX files are ZIP archives; all valid .xlsx start with PK\x03\x04
const XLSX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

export const EXPERIMENT_PHASES = Object.freeze({
  PRE: 'pre',
  POST: 'post',
});

const VALID_EXPERIMENT_PHASES = new Set(Object.values(EXPERIMENT_PHASES));

export const SCRAPE_DATASET_IDS = Object.freeze({
  REDDIT_COMMENTS: 'reddit_comments',
  REDDIT_POSTS: 'reddit_posts',
  TOP_CITED: 'topCited',
  YOUTUBE_COMMENTS: 'youtube_comments',
  YOUTUBE_VIDEOS: 'youtube_videos',
  WIKIPEDIA: 'wikipedia',
});

const VALID_SCRAPE_DATASET_IDS = new Set(Object.values(SCRAPE_DATASET_IDS));

const URL_LOOKUP_BATCH_SIZE = 100;

// Reddit-comments specific scrape parameters.
// Exported so callers can validate `sortBy` at their own boundary without
// duplicating the allowlist. Frozen for consistency with the sibling
// EXPERIMENT_PHASES / SCRAPE_DATASET_IDS exports (note: Object.freeze does
// not actually prevent Set mutation methods — the ReadonlySet<> type in the
// .d.ts is what guards TypeScript consumers).
export const REDDIT_COMMENTS_SORT_BY_VALUES = Object.freeze(
  new Set(['Best', 'Top', 'New', 'Controversial', 'Old', 'Q&A']),
);
const REDDIT_COMMENTS_DEFAULT_COMMENT_LIMIT = 150;
const REDDIT_COMMENTS_DEFAULT_SORT_BY = 'Best';
const REDDIT_COMMENTS_ONLY_PARAMS = ['daysBack', 'commentLimit', 'sortBy', 'loadAllReplies'];

// Canonical brand-presence schedule definition (LLMO-5605). This is the SINGLE source of
// truth for the recurring brand-presence schedule: both the self-serve activate-brand
// endpoint (spacecat-api-service) and the audit-worker `llmo-customer-analysis` onboarding
// cascade create the schedule through `createBrandPresenceSchedule` below. DRS dedups
// schedules on (site_id, brand_id, cadence, provider-set), so the provider set MUST be
// identical across callers — one definition is what keeps the dedup matching (two
// hand-synced payloads would drift and silently produce duplicate schedules).
const BRAND_PRESENCE_PROVIDER_IDS = Object.freeze([
  'brightdata',
  'google_ai_overviews',
  'openai_web_search',
]);
const BRAND_PRESENCE_BRIGHTDATA_PLATFORMS = Object.freeze([
  'chatgpt_free',
  'perplexity',
  'gemini',
  'copilot',
  'aimode',
]);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export default class DrsClient {
  /**
   * Creates a DrsClient from a universal context object.
   * @param {object} context - Context with env and log
   * @returns {DrsClient}
   */
  static createFrom(context) {
    const { env, log = console } = context;
    const {
      DRS_API_URL: apiBaseUrl,
      DRS_API_KEY: apiKey,
      DRS_S3_BUCKET: s3Bucket,
      DRS_SNS_TOPIC_ARN: snsTopicArn,
      AWS_REGION: awsRegion,
    } = env;

    if (context.drsClient) {
      return context.drsClient;
    }

    const client = new DrsClient({
      apiBaseUrl, apiKey, s3Bucket, snsTopicArn, awsRegion,
    }, log);
    context.drsClient = client;
    return client;
  }

  constructor({
    apiBaseUrl,
    apiKey,
    s3Bucket,
    snsTopicArn,
    awsRegion,
    s3Client,
    snsClient,
  }, log = console) {
    // Strip trailing slashes without regex (CodeQL flags /\/+$/ as polynomial)
    let url = apiBaseUrl;
    if (url) {
      while (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
    }
    this.apiBaseUrl = url || undefined;
    this.apiKey = apiKey;
    this.s3Bucket = s3Bucket;
    this.snsTopicArn = snsTopicArn;
    this.s3Client = s3Client ?? instrumentAWSClient(new S3Client({ region: awsRegion }));
    this.snsClient = snsClient ?? instrumentAWSClient(new SNSClient({ region: awsRegion }));
    this.log = log;
  }

  /**
   * @returns {boolean} True if DRS_API_URL and DRS_API_KEY are set
   */
  isConfigured() {
    return hasText(this.apiBaseUrl) && hasText(this.apiKey);
  }

  /**
   * @returns {boolean} True if DRS_S3_BUCKET and DRS_SNS_TOPIC_ARN are set
   */
  isS3Configured() {
    return hasText(this.s3Bucket) && hasText(this.snsTopicArn);
  }

  async #request(method, path, body = undefined, fetchOptions = {}) {
    const { ok, status, body: payload } = await this.#requestRaw(method, path, body, fetchOptions);

    if (!ok) {
      const errorText = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const error = new Error(`DRS ${method} ${path} failed: ${status} - ${errorText}`);
      error.status = status;
      throw error;
    }

    // #requestRaw parses application/json into an object and returns the raw text
    // otherwise; preserve the historical contract: the parsed object for JSON, null
    // for any non-JSON (or empty) body.
    return typeof payload === 'object' ? payload : null;
  }

  /**
   * Like {@link DrsClient##request} but returns the parsed body together with the HTTP
   * status instead of throwing on a non-2xx response. Used where a specific non-2xx status
   * is a normal, expected outcome the caller must inspect — e.g. `createBrandPresenceSchedule`
   * treats a 409 from the DRS schedule dedup as success.
   * @returns {Promise<{ ok: boolean, status: number, body: object|string|null }>}
   */
  async #requestRaw(method, path, body = undefined, fetchOptions = {}) {
    if (!this.isConfigured()) {
      throw new Error('DRS client is not configured. Set DRS_API_URL and DRS_API_KEY environment variables.');
    }

    const url = `${this.apiBaseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      ...fetchOptions,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { ok: response.ok, status: response.status, body: payload };
  }

  /**
   * Submits a generic job to DRS.
   * @param {object} params - Job parameters (provider_id, source, parameters, etc.)
   * @returns {Promise<object>} Job submission result with job_id
   */
  async submitJob(params) {
    this.log.info('Submitting DRS job', { providerId: params.provider_id });
    const result = await this.#request('POST', '/jobs', params);
    this.log.info(`DRS job submitted: ${result?.job_id}`, { jobId: result?.job_id });
    return result;
  }

  /**
   * Submits a prompt generation job to DRS.
   * @param {object} params
   * @param {string} params.baseUrl - Site base URL
   * @param {string} params.brandName - Brand name
   * @param {string} params.audience - Target audience
   * @param {string} [params.region='US'] - Region
   * @param {number} [params.numPrompts=50] - Number of prompts
   * @param {string} [params.source='onboarding'] - Job source
   * @param {string} params.siteId - SpaceCat site ID
   * @param {string} params.imsOrgId - IMS organization ID
   * @returns {Promise<object>} Job result with job_id
   */
  async submitPromptGenerationJob({
    baseUrl,
    brandName,
    audience,
    region = 'US',
    numPrompts = 50,
    source = 'onboarding',
    siteId,
    imsOrgId,
  }) {
    this.log.info(`Submitting DRS prompt generation job for site ${siteId}`, {
      baseUrl, brandName, region, numPrompts,
    });

    return this.submitJob({
      provider_id: 'prompt_generation_base_url',
      source,
      parameters: {
        base_url: baseUrl,
        brand: brandName,
        audience,
        region,
        num_prompts: numPrompts,
        model: 'gpt-5-nano', // DRS default model for prompt generation
        metadata: {
          site_id: siteId,
          imsOrgId,
          base_url: baseUrl,
          brand: brandName,
          region,
        },
      },
    });
  }

  /**
   * Submits a scrape job to DRS via the Bright Data provider.
   *
   * Reddit-comments-only parameters (`daysBack`, `commentLimit`, `sortBy`,
   * `loadAllReplies`) are rejected for any other dataset. When the dataset is
   * `reddit_comments`, `commentLimit` defaults to 150 and `sortBy` defaults to
   * 'Best'; `daysBack` and `loadAllReplies` are omitted from the request when
   * not provided (Bright Data treats absent fields as "no filter").
   *
   * @param {object} params
   * @param {string} params.datasetId - One of SCRAPE_DATASET_IDS values
   * @param {string} params.siteId - SpaceCat site ID
   * @param {string[]} params.urls - URLs to scrape
   * @param {string} [params.priority='HIGH'] - Job priority (HIGH or LOW)
   * @param {string} [params.spacecatOrgId] - SpaceCat organization ID
   * @param {string} [params.imsOrgId] - IMS organization ID. When provided, it is attached as
   *   `parameters.metadata.imsOrgId` so DRS can scope the job's S2S token without relying on
   *   resolving the org from `site_id`. When omitted, DRS falls back to `site_id` auto-resolution.
   * @param {string} [params.brand] - Brand name; attached as `parameters.metadata.brand` only
   *   when `imsOrgId` is also provided.
   * @param {number} [params.daysBack] - Time-window filter in days (reddit_comments only)
   * @param {number} [params.commentLimit=150] - Max comments per thread (reddit_comments only)
   * @param {('Best'|'Top'|'New'|'Controversial'|'Old'|'Q&A')} [params.sortBy='Best']
   *   Sort order for Bright Data (reddit_comments only)
   * @param {boolean} [params.loadAllReplies] - Whether to expand all reply trees
   *   (reddit_comments only)
   * @returns {Promise<object>} Job result with job_id
   */
  async submitScrapeJob({
    datasetId,
    siteId,
    urls,
    priority = 'HIGH',
    daysBack,
    spacecatOrgId,
    imsOrgId,
    brand,
    commentLimit,
    sortBy,
    loadAllReplies,
  }) {
    if (!VALID_SCRAPE_DATASET_IDS.has(datasetId)) {
      throw new Error(`Invalid dataset_id "${datasetId}". Must be one of: ${[...VALID_SCRAPE_DATASET_IDS].join(', ')}`);
    }
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls must be a non-empty array of strings');
    }
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }

    const isRedditComments = datasetId === SCRAPE_DATASET_IDS.REDDIT_COMMENTS;
    if (!isRedditComments) {
      const providedRedditParam = REDDIT_COMMENTS_ONLY_PARAMS.find(
        (name) => ({
          daysBack, commentLimit, sortBy, loadAllReplies,
        }[name] !== undefined),
      );
      if (providedRedditParam) {
        throw new Error(`${providedRedditParam} is only supported for reddit_comments dataset`);
      }
    }

    if (daysBack !== undefined && !isPositiveInteger(daysBack)) {
      throw new Error('daysBack must be a positive integer');
    }
    if (commentLimit !== undefined && !isPositiveInteger(commentLimit)) {
      throw new Error('commentLimit must be a positive integer');
    }
    if (sortBy !== undefined && !REDDIT_COMMENTS_SORT_BY_VALUES.has(sortBy)) {
      throw new Error(`Invalid sortBy "${sortBy}". Must be one of: ${[...REDDIT_COMMENTS_SORT_BY_VALUES].join(', ')}`);
    }
    if (loadAllReplies !== undefined && typeof loadAllReplies !== 'boolean') {
      throw new Error('loadAllReplies must be a boolean');
    }

    this.log.info(`Submitting DRS scrape job for dataset ${datasetId}`, { datasetId, siteId, urlCount: urls.length });

    const parameters = {
      dataset_id: datasetId,
      site_id: siteId,
      urls,
    };

    if (imsOrgId) {
      parameters.metadata = {
        imsOrgId,
        ...(brand ? { brand } : {}),
      };
    }

    if (isRedditComments) {
      parameters.comment_limit = commentLimit ?? REDDIT_COMMENTS_DEFAULT_COMMENT_LIMIT;
      parameters.sort_by = sortBy ?? REDDIT_COMMENTS_DEFAULT_SORT_BY;

      if (daysBack !== undefined) {
        parameters.days_back = daysBack;
      }

      if (loadAllReplies !== undefined) {
        parameters.load_all_replies = loadAllReplies;
      }
    }

    const jobParams = {
      provider_id: 'brightdata',
      priority,
      parameters,
    };
    if (spacecatOrgId) {
      jobParams.spacecat_org_id = spacecatOrgId;
    }

    return this.submitJob(jobParams);
  }

  /**
   * Looks up scraping results for an array of URLs.
   * Transparently batches requests when the URL list exceeds URL_LOOKUP_BATCH_SIZE (100),
   * merging all results into a single response with aggregated summary counts.
   * @param {object} params
   * @param {string} params.datasetId - One of SCRAPE_DATASET_IDS values
   * @param {string} params.siteId - SpaceCat site ID
   * @param {string[]} params.urls - URLs to look up
   * @returns {Promise<object>} Lookup results
   */
  async lookupScrapeResults({ datasetId, siteId, urls }) {
    if (!VALID_SCRAPE_DATASET_IDS.has(datasetId)) {
      throw new Error(`Invalid dataset_id "${datasetId}". Must be one of: ${[...VALID_SCRAPE_DATASET_IDS].join(', ')}`);
    }
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls must be a non-empty array of strings');
    }
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }

    this.log.info(`Looking up scrape results for dataset ${datasetId}`, { datasetId, siteId, urlCount: urls.length });

    if (urls.length <= URL_LOOKUP_BATCH_SIZE) {
      return this.#request('POST', '/url-lookup', {
        dataset_id: datasetId,
        site_id: siteId,
        urls,
      });
    }

    const batches = [];
    for (let i = 0; i < urls.length; i += URL_LOOKUP_BATCH_SIZE) {
      batches.push(urls.slice(i, i + URL_LOOKUP_BATCH_SIZE));
    }

    this.log.info(`URL list exceeds batch size, splitting into ${batches.length} batches`, { datasetId, siteId, batchCount: batches.length });

    const responses = await Promise.all(
      batches.map((batch) => this.#request('POST', '/url-lookup', {
        dataset_id: datasetId,
        site_id: siteId,
        urls: batch,
      })),
    );

    const mergedResults = responses.flatMap((r) => r.results ?? []);
    const mergedSummary = responses.reduce(
      (acc, r) => {
        const s = r.summary ?? {};
        return {
          total: acc.total + (s.total ?? 0),
          available: acc.available + (s.available ?? 0),
          scraping: acc.scraping + (s.scraping ?? 0),
          not_found: acc.not_found + (s.not_found ?? 0),
        };
      },
      {
        total: 0, available: 0, scraping: 0, not_found: 0,
      },
    );

    return { results: mergedResults, summary: mergedSummary };
  }

  /**
   * Triggers brand detection re-analysis on existing data for a site.
   * @param {string} siteId - SpaceCat site ID
   * @param {object} [options={}]
   * @param {string} [options.batchId] - Specific batch to re-analyze
   * @param {string} [options.priority] - Job priority (HIGH, NORMAL)
   * @returns {Promise<object>} Trigger result
   */
  async triggerBrandDetection(siteId, options = {}) {
    this.log.info(`Triggering DRS brand detection for site ${siteId}`, options);
    return this.#request('POST', `/sites/${siteId}/brand-detection`, options);
  }

  /**
   * Creates an experiment schedule in DRS.
   * @param {object} params
   * @param {string} params.siteId - SpaceCat site ID
   * @param {string} params.experimentId - Unique experiment identifier
   * @param {string} params.experimentPhase - 'pre' or 'post'
   * @param {string} params.cronExpression - Cron expression for the schedule
   * @param {string} params.expiresAt - ISO 8601 timestamp for schedule expiry
   * @param {string[]} params.platforms - LLM platforms to query (used as brightdata dataset_id)
   * @param {string[]} params.providerIds - DRS provider IDs
   * @param {boolean} params.triggerImmediately - Trigger first job on schedule creation
   * @param {boolean} [params.enableBrandPresence] - Enable brand presence detection in the job
   * @param {object} [params.metadata] - Additional metadata to attach to the job
   * @param {number} [params.timeout] - Fetch timeout in ms; omit to use tracingFetch default
   * @returns {Promise<object>} Schedule creation response
   */
  async createExperimentSchedule({
    siteId,
    experimentId,
    experimentPhase,
    cronExpression,
    expiresAt,
    platforms,
    providerIds,
    triggerImmediately,
    enableBrandPresence = false,
    metadata,
    timeout,
  }) {
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }
    if (!hasText(experimentId)) {
      throw new Error('experimentId is required');
    }
    if (!VALID_EXPERIMENT_PHASES.has(experimentPhase)) {
      throw new Error(`experimentPhase must be one of: ${[...VALID_EXPERIMENT_PHASES].join(', ')}`);
    }
    if (!hasText(cronExpression)) {
      throw new Error('cronExpression is required');
    }
    if (!hasText(expiresAt)) {
      throw new Error('expiresAt is required');
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      throw new Error('platforms must be a non-empty array');
    }
    if (!Array.isArray(providerIds) || providerIds.length === 0) {
      throw new Error('providerIds must be a non-empty array');
    }

    const body = {
      site_id: siteId,
      frequency: 'cron',
      cron_expression: cronExpression,
      expires_at: expiresAt,
      trigger_immediately: triggerImmediately === true,
      description: `${experimentPhase} phase schedule of geo experiment: ${experimentId}`,
      job_config: {
        cadence: 'experiment',
        enable_brand_presence: enableBrandPresence,
        provider_ids: providerIds,
        provider_parameters: {
          brightdata: {
            dataset_id: platforms.join(','),
            metadata: {
              site: siteId,
            },
          },
        },
        priority: 'HIGH',
        metadata: {
          experiment_id: experimentId,
          experiment_phase: experimentPhase,
          ...(metadata || {}),
        },
      },
    };

    this.log.info(`Creating DRS experiment schedule for site ${siteId}`, {
      experimentId,
      experimentPhase,
      cronExpression,
      expiresAt,
      triggerImmediately: body.trigger_immediately,
    });

    const result = await this.#request('POST', '/schedules', body, timeout ? { timeout } : {});
    this.log.info('DRS experiment schedule created', {
      scheduleId: result?.schedule?.schedule_id || result?.schedule_id,
      experimentId,
      experimentPhase,
    });
    return result;
  }

  /**
   * Creates (or reuses) the recurring weekly brand-presence schedule for a site.
   *
   * SINGLE shared definition of the brand-presence schedule (LLMO-5605): the self-serve
   * activate-brand endpoint and the audit-worker `llmo-customer-analysis` onboarding cascade
   * both create the schedule through this method. DRS dedups schedules on
   * (site_id, brand_id, cadence, provider-set) and returns 409 + `existing_schedule_id` on a
   * match, so this POSTs and treats a 409 as success (idempotent).
   *
   * @param {object} params
   * @param {string} params.siteId - SpaceCat site UUID (required).
   * @param {string} [params.brandId] - SpaceCat brand UUID (sent top-level; required for v2 dedup).
   * @param {string} [params.orgId] - SpaceCat org UUID (sent top-level as `spacecat_org_id`).
   * @param {('HIGH'|'LOW')} [params.priority='LOW'] - Job priority.
   * @param {string} [params.description] - Schedule description (NOT part of the dedup key).
   * @param {boolean} [params.triggerImmediately=false] - Trigger the first run on creation.
   * @param {number} [params.timeout] - Fetch timeout in ms; omit for the tracingFetch default.
   * @returns {Promise<{ scheduleId: string, alreadyExisted: boolean }>}
   */
  async createBrandPresenceSchedule({
    siteId,
    brandId,
    orgId,
    priority = 'LOW',
    description,
    triggerImmediately = false,
    timeout,
  }) {
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }
    if (!hasText(brandId)) {
      this.log.debug(`createBrandPresenceSchedule: no brandId; dedup is site-level for ${siteId}`);
    }

    const body = {
      site_id: siteId,
      ...(hasText(brandId) ? { brand_id: brandId } : {}),
      ...(hasText(orgId) ? { spacecat_org_id: orgId } : {}),
      frequency: 'weekly',
      cron_expression: 'auto',
      description: description || `Brand presence: ${siteId}`,
      job_config: {
        provider_ids: [...BRAND_PRESENCE_PROVIDER_IDS],
        priority,
        enable_brand_presence: true,
        cadence: 'weekly',
        provider_parameters: {
          brightdata: {
            siteId,
            metadata: { site: siteId },
            dataset_id: BRAND_PRESENCE_BRIGHTDATA_PLATFORMS.join(','),
            platforms: [...BRAND_PRESENCE_BRIGHTDATA_PLATFORMS],
          },
          google_ai_overviews: {
            siteId,
            metadata: { site: siteId },
          },
          openai_web_search: {
            siteId,
            metadata: { site: siteId },
          },
        },
      },
    };

    this.log.info(`Creating brand presence schedule for site ${siteId}`, {
      brandId, orgId, triggerImmediately,
    });
    const { ok, status, body: payload } = await this.#requestRaw(
      'POST',
      '/schedules',
      body,
      timeout ? { timeout } : {},
    );

    // DRS returns top-level `schedule_id` on 201 and `existing_schedule_id` on a 409 dedup
    // (create_schedule.py: 668-670 and 621-628).
    let scheduleId;
    let alreadyExisted = false;
    if (ok) {
      scheduleId = payload?.schedule_id;
    } else if (status === 409) {
      alreadyExisted = true;
      scheduleId = payload?.existing_schedule_id;
      this.log.info(`Brand presence schedule already exists for site ${siteId}: ${scheduleId}`);
    } else {
      const errorText = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const error = new Error(`DRS POST /schedules failed: ${status} - ${errorText}`);
      error.status = status;
      throw error;
    }

    if (!hasText(scheduleId)) {
      throw new Error('DRS schedule create/dedup returned no schedule_id');
    }

    if (triggerImmediately) {
      this.log.info(`Triggering brand presence schedule ${scheduleId} for site ${siteId}`);
      await this.#request('POST', `/schedules/${siteId}/${scheduleId}/trigger`);
    }

    return { scheduleId, alreadyExisted };
  }

  /**
   * Gets schedule details with jobs summary from DRS.
   * @param {string} siteId - SpaceCat site ID
   * @param {string} scheduleId - DRS schedule ID
   * @param {object} [options={}]
   * @param {boolean} [options.includeJobs=false] - Include per-job details in the response
   * @returns {Promise<object>} Schedule + jobs summary payload
   */
  async getScheduleStatus(siteId, scheduleId, { includeJobs = false } = {}) {
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }
    if (!hasText(scheduleId)) {
      throw new Error('scheduleId is required');
    }

    const path = includeJobs
      ? `/schedules/${siteId}/${scheduleId}?include_jobs=true`
      : `/schedules/${siteId}/${scheduleId}`;

    this.log.info('Getting DRS schedule status', { siteId, scheduleId, includeJobs });
    return this.#request('GET', path);
  }

  /**
   * Gets job status and details.
   * @param {string} jobId - DRS job ID
   * @returns {Promise<object>} Job details
   */
  async getJob(jobId) {
    return this.#request('GET', `/jobs/${jobId}`);
  }

  /**
   * Lists DRS jobs for a site, with optional filters. Thin wrapper over the DRS
   * `GET /jobs` endpoint (backed by the `site-submitted-index` GSI). Used to dedup
   * in-flight prompt-generation jobs before submitting a new one (LLMO-5605).
   *
   * Note: the DRS `status` filter is single-valued. To find non-terminal jobs
   * (QUEUED *or* RUNNING), omit `status` and filter the returned array client-side.
   *
   * @param {object} params
   * @param {string} params.siteId - SpaceCat site UUID (required; maps to the `site` query param).
   * @param {string} [params.providerId] - DRS provider id to filter by.
   * @param {string} [params.status] - Filter by a single status (QUEUED/RUNNING/COMPLETED/FAILED).
   * @param {string} [params.source] - Filter by job source (e.g. 'brand-activation').
   * @param {number} [params.submittedFrom] - Unix timestamp lower bound on submitted_at.
   * @returns {Promise<object[]>} Array of job records (empty array when none).
   */
  async listJobs({
    siteId,
    providerId,
    status,
    source,
    submittedFrom,
  } = {}) {
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }

    const query = new URLSearchParams({ site: siteId });
    if (hasText(providerId)) {
      query.set('provider_id', providerId);
    }
    if (hasText(status)) {
      query.set('status', status);
    }
    if (hasText(source)) {
      query.set('source', source);
    }
    if (submittedFrom != null) {
      query.set('submitted_from', String(submittedFrom));
    }

    const result = await this.#request('GET', `/jobs?${query.toString()}`);
    return Array.isArray(result?.jobs) ? result.jobs : [];
  }

  /**
   * Uploads a brand presence Excel file directly to the DRS S3 bucket.
   * @param {string} siteId - SpaceCat site ID
   * @param {string} jobId - Unique job ID (used to derive the S3 key)
   * @param {Buffer|Uint8Array} excelBuffer - Raw Excel file bytes
   * @returns {Promise<string>} S3 URI of the uploaded file (s3://bucket/key)
   */
  async uploadExcelToDrs(siteId, jobId, excelBuffer) {
    if (!this.isS3Configured()) {
      throw new Error('DRS S3 is not configured. Set DRS_S3_BUCKET and DRS_SNS_TOPIC_ARN environment variables.');
    }
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }
    if (!hasText(jobId)) {
      throw new Error('jobId is required');
    }
    if (!excelBuffer || excelBuffer.length === 0) {
      throw new Error('excelBuffer is required and must be non-empty');
    }
    if (!Buffer.from(excelBuffer.subarray(0, 4)).equals(XLSX_MAGIC)) {
      throw new Error(`Refusing to upload non-XLSX content to S3 (size=${excelBuffer.length})`);
    }

    const key = `${DRS_S3_KEY_PREFIX}/${siteId}/${jobId}/source.xlsx`;
    this.log.info('Uploading Excel to DRS S3', { siteId, jobId, key });

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      Body: excelBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ServerSideEncryption: 'AES256',
    }));

    const uri = `s3://${this.s3Bucket}/${key}`;
    this.log.info('Excel uploaded to DRS S3', { uri });
    return uri;
  }

  /**
   * Publishes a JOB_COMPLETED SNS event to trigger DRS Fargate brand presence analysis.
   * Returns the job ID used in the SNS message so the caller can correlate logs.
   * @param {string} siteId - SpaceCat site ID
   * @param {object} params
   * @param {string} params.resultLocation - S3 URI of the uploaded Excel file
   * @param {string} [params.jobId] - Job ID that matches the one used in uploadExcelToDrs.
   *   When omitted a new spacecat-{uuid} is generated — only safe when the caller does not
   *   need the SNS job_id to match an existing S3 key.
   * @param {string} [params.webSearchProvider] - Provider string (e.g. 'chatgpt', 'gemini')
   * @param {string} [params.configVersion] - SpaceCat config schema version
   * @param {number} [params.week] - ISO week number
   * @param {number} [params.year] - Year
   * @param {string} [params.runFrequency] - 'daily' | 'weekly'
   * @param {string} [params.brand] - Brand name
   * @param {string} [params.imsOrgId] - IMS organization ID
   * @param {string} [params.brandId] - SpaceCat brand UUID; signals v2 onboarding to the
   *   downstream Fargate runner. When set, the runner reads brand/topic/category/prompt
   *   config from the v2 PostgREST tables; when undefined the runner falls back to v1
   *   config sourced from the legacy spreadsheet mirror.
   * @returns {Promise<string>} The job ID used in the SNS message
   */
  async publishBrandPresenceAnalyze(siteId, {
    jobId = `spacecat-${randomUUID()}`,
    resultLocation,
    webSearchProvider,
    configVersion,
    week,
    year,
    runFrequency,
    brand,
    imsOrgId,
    brandId,
  } = {}) {
    if (!this.isS3Configured()) {
      throw new Error('DRS S3 is not configured. Set DRS_S3_BUCKET and DRS_SNS_TOPIC_ARN environment variables.');
    }
    if (!hasText(siteId)) {
      throw new Error('siteId is required');
    }
    if (!hasText(resultLocation)) {
      throw new Error('resultLocation is required');
    }

    const message = {
      event_type: 'JOB_COMPLETED',
      job_id: jobId,
      provider_id: EXTERNAL_SPACECAT_PROVIDER_ID,
      result_location: resultLocation,
      reanalysis: true,
      metadata: {
        site_id: siteId,
        brand,
        imsOrgId,
        web_search_provider: webSearchProvider,
        config_version: configVersion,
        ...(runFrequency && { run_frequency: runFrequency }),
        ...(hasText(brandId) && { brand_id: brandId }),
      },
      ...(week != null && { week }),
      ...(year != null && { year }),
    };

    this.log.info('Publishing brand presence analyze SNS event', { jobId, siteId, resultLocation });

    await this.snsClient.send(new PublishCommand({
      TopicArn: this.snsTopicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        event_type: { DataType: 'String', StringValue: 'JOB_COMPLETED' },
        provider_id: { DataType: 'String', StringValue: EXTERNAL_SPACECAT_PROVIDER_ID },
      },
    }));

    this.log.info('Brand presence analyze SNS event published', { jobId });
    return jobId;
  }
}
