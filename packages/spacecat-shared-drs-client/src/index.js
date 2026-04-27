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

  async #request(method, path, body = undefined) {
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
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DRS ${method} ${path} failed: ${response.status} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return null;
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
   * @param {object} params
   * @param {string} params.datasetId - One of SCRAPE_DATASET_IDS values
   * @param {string} params.siteId - SpaceCat site ID
   * @param {string[]} params.urls - URLs to scrape
   * @param {string} [params.priority='HIGH'] - Job priority (HIGH or LOW)
   * @param {number} [params.daysBack] - Number of days back to scrape (reddit_comments only)
   * @returns {Promise<object>} Job result with job_id
   */
  async submitScrapeJob({
    datasetId,
    siteId,
    urls,
    priority = 'HIGH',
    daysBack,
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
    if (daysBack !== undefined && datasetId !== SCRAPE_DATASET_IDS.REDDIT_COMMENTS) {
      throw new Error('daysBack is only supported for reddit_comments dataset');
    }

    this.log.info(`Submitting DRS scrape job for dataset ${datasetId}`, { datasetId, siteId, urlCount: urls.length });

    const parameters = {
      dataset_id: datasetId,
      site_id: siteId,
      urls,
    };
    if (daysBack !== undefined) {
      parameters.days_back = daysBack;
    }

    return this.submitJob({
      provider_id: 'brightdata',
      priority,
      parameters,
    });
  }

  /**
   * Looks up scraping results for an array of URLs.
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

    return this.#request('POST', '/url-lookup', {
      dataset_id: datasetId,
      site_id: siteId,
      urls,
    });
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

    const result = await this.#request('POST', '/schedules', body);
    this.log.info('DRS experiment schedule created', {
      scheduleId: result?.schedule?.schedule_id || result?.schedule_id,
      experimentId,
      experimentPhase,
    });
    return result;
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

    const key = `${DRS_S3_KEY_PREFIX}/${siteId}/${jobId}/source.xlsx`;
    this.log.info(`Uploading Excel to DRS S3`, { siteId, jobId, key });

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      Body: excelBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ServerSideEncryption: 'AES256',
    }));

    const uri = `s3://${this.s3Bucket}/${key}`;
    this.log.info(`Excel uploaded to DRS S3`, { uri });
    return uri;
  }

  /**
   * Publishes a JOB_COMPLETED SNS event to trigger DRS Fargate brand presence analysis.
   * Generates a unique job ID internally and returns it so the caller can correlate logs.
   * @param {string} siteId - SpaceCat site ID
   * @param {object} params
   * @param {string} params.resultLocation - S3 URI of the uploaded Excel file
   * @param {string} [params.webSearchProvider] - Provider string (e.g. 'chatgpt', 'google_ai_overviews')
   * @param {string} [params.configVersion] - SpaceCat config schema version
   * @param {number} [params.week] - ISO week number
   * @param {number} [params.year] - Year
   * @param {string} [params.runFrequency] - 'daily' | 'weekly'
   * @param {string} [params.brand] - Brand name
   * @param {string} [params.imsOrgId] - IMS organization ID
   * @returns {Promise<string>} The generated job ID
   */
  async publishBrandPresenceAnalyze(siteId, {
    resultLocation,
    webSearchProvider,
    configVersion,
    week,
    year,
    runFrequency,
    brand,
    imsOrgId,
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

    const jobId = `spacecat-${randomUUID()}`;

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
      },
      ...(week != null && { week }),
      ...(year != null && { year }),
    };

    this.log.info(`Publishing brand presence analyze SNS event`, { jobId, siteId, resultLocation });

    await this.snsClient.send(new PublishCommand({
      TopicArn: this.snsTopicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        event_type: { DataType: 'String', StringValue: 'JOB_COMPLETED' },
        provider_id: { DataType: 'String', StringValue: EXTERNAL_SPACECAT_PROVIDER_ID },
      },
    }));

    this.log.info(`Brand presence analyze SNS event published`, { jobId });
    return jobId;
  }
}
