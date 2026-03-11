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

import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';

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
    const { DRS_API_URL: apiBaseUrl, DRS_API_KEY: apiKey } = env;

    if (context.drsClient) return context.drsClient;

    const client = new DrsClient({ apiBaseUrl, apiKey }, log);
    context.drsClient = client;
    return client;
  }

  constructor({ apiBaseUrl, apiKey }, log = console) {
    // Strip trailing slashes without regex (CodeQL flags /\/+$/ as polynomial)
    let url = apiBaseUrl;
    if (url) {
      while (url.endsWith('/')) url = url.slice(0, -1);
    }
    this.apiBaseUrl = url || undefined;
    this.apiKey = apiKey;
    this.log = log;
  }

  /**
   * @returns {boolean} True if DRS_API_URL and DRS_API_KEY are set
   */
  isConfigured() {
    return hasText(this.apiBaseUrl) && hasText(this.apiKey);
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
   * Gets job status and details.
   * @param {string} jobId - DRS job ID
   * @returns {Promise<object>} Job details
   */
  async getJob(jobId) {
    return this.#request('GET', `/jobs/${jobId}`);
  }
}
