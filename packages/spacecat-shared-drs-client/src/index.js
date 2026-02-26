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

import {
  hasText, isValidUrl, isArray, tracingFetch as fetch,
} from '@adobe/spacecat-shared-utils';

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_POLL_INTERVAL_MS = 15000;
const DEFAULT_MAX_TIMEOUT_MS = 600000;

export const VALID_DATASET_IDS = Object.freeze([
  'youtube_videos',
  'youtube_comments',
  'reddit_posts',
  'reddit_comments',
  'wikipedia',
]);

export const JOB_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

const TERMINAL_STATUSES = new Set([JOB_STATUSES.COMPLETED, JOB_STATUSES.FAILED]);

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Client for the Data Retrieval Service (DRS) API.
 * Provides methods to submit data retrieval jobs, poll for completion,
 * and look up previously retrieved URLs.
 */
export default class DrsClient {
  /**
   * Creates a DrsClient from a Universal context.
   * Caches the instance on the context object for subsequent calls.
   * @param {Object} context - Universal function context
   * @param {Object} context.env - Environment variables
   * @param {string} context.env.DRS_API_URL - DRS API base URL
   * @param {string} context.env.DRS_API_KEY - DRS API key
   * @param {Object} [context.log] - Logger (defaults to console)
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

  /**
   * @param {Object} config - Client configuration
   * @param {string} config.apiBaseUrl - DRS API base URL (must be a valid URL)
   * @param {string} config.apiKey - DRS API key
   * @param {Object} [log] - Logger (defaults to console)
   */
  constructor({ apiBaseUrl, apiKey }, log = console) {
    this.log = log;
    if (!isValidUrl(apiBaseUrl)) {
      throw this.#createError('Invalid or missing DRS API Base URL', HTTP_BAD_REQUEST);
    }
    if (!hasText(apiKey)) {
      throw this.#createError('Invalid or missing DRS API Key', HTTP_BAD_REQUEST);
    }
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Creates an Error with an HTTP status code and logs it.
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @returns {Error}
   */
  #createError(message, status) {
    const error = Object.assign(new Error(message), { status });
    this.log.error(error.message);
    return error;
  }

  /**
   * Sends an authenticated request to the DRS API.
   * Handles error responses by attempting to parse the error body for a message.
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} endpoint - API endpoint path (e.g. '/jobs')
   * @param {Object} [body] - Request body (JSON-serialized automatically)
   * @returns {Promise<Object>} Parsed JSON response
   */
  async #sendRequest(method, endpoint, body) {
    const headers = { 'x-api-key': this.apiKey };
    const options = { method, headers };

    if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const url = `${this.apiBaseUrl}${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `DRS API request to ${endpoint} failed with status: ${response.status}`;
      try {
        const errorBody = await response.json();
        if (hasText(errorBody.message)) {
          errorMessage += ` - ${errorBody.message}`;
        }
      } catch (e) {
        this.log.error(`Error parsing DRS API error response: ${e.message}`);
      }
      throw this.#createError(errorMessage, response.status);
    }

    try {
      return await response.json();
    } catch (e) {
      throw this.#createError(
        `Error parsing DRS API response from ${endpoint}: ${e.message}`,
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Submits a data retrieval job to the DRS API.
   * @param {Object} jobParams - Job parameters
   * @param {string} jobParams.datasetId - Dataset identifier (must be one of VALID_DATASET_IDS)
   * @param {string[]} jobParams.urls - Non-empty array of URLs to retrieve data from
   * @param {Object} jobParams.metadata - Job metadata
   * @param {string} jobParams.metadata.imsOrgId - IMS Organization ID
   * @param {string} jobParams.metadata.brand - Brand name
   * @param {string} jobParams.metadata.site - Site domain
   * @returns {Promise<Object>} Job submission response including job_id and status
   */
  async submitJob({ datasetId, urls, metadata }) {
    if (!hasText(datasetId) || !VALID_DATASET_IDS.includes(datasetId)) {
      throw this.#createError(
        `Invalid dataset ID: ${datasetId}. Must be one of: ${VALID_DATASET_IDS.join(', ')}`,
        HTTP_BAD_REQUEST,
      );
    }
    if (!isArray(urls) || urls.length === 0) {
      throw this.#createError('URLs must be a non-empty array', HTTP_BAD_REQUEST);
    }
    if (!metadata
      || !hasText(metadata.imsOrgId) || !hasText(metadata.brand) || !hasText(metadata.site)) {
      throw this.#createError('Metadata must include imsOrgId, brand, and site', HTTP_BAD_REQUEST);
    }

    const jobRequest = {
      provider_id: 'brightdata',
      priority: 'HIGH',
      parameters: {
        dataset_id: datasetId,
        urls,
      },
      metadata: {
        imsOrgId: metadata.imsOrgId,
        brand: metadata.brand,
        site: metadata.site,
      },
    };

    return this.#sendRequest('POST', '/jobs', jobRequest);
  }

  /**
   * Retrieves the current status of a DRS job, including a presigned S3 URL
   * for downloading the result if the job has completed.
   * @param {string} jobId - The job identifier
   * @returns {Promise<Object>} Job status response
   */
  async getJobStatus(jobId) {
    if (!hasText(jobId)) {
      throw this.#createError('Job ID is required', HTTP_BAD_REQUEST);
    }

    return this.#sendRequest('GET', `/jobs/${jobId}?include_result_url=true`);
  }

  /**
   * Polls a DRS job until it reaches a terminal status (COMPLETED or FAILED)
   * or the timeout is exceeded.
   * @param {string} jobId - The job identifier
   * @param {Object} [options] - Polling options
   * @param {number} [options.pollIntervalMs=15000] - Interval between polls in milliseconds
   * @param {number} [options.maxTimeoutMs=600000] - Maximum time to poll before timing out
   * @returns {Promise<Object>} Final job status response
   */
  async pollJobStatus(
    jobId,
    { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, maxTimeoutMs = DEFAULT_MAX_TIMEOUT_MS } = {},
  ) {
    if (!hasText(jobId)) {
      throw this.#createError('Job ID is required', HTTP_BAD_REQUEST);
    }

    const startTime = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const status = await this.getJobStatus(jobId);

      if (TERMINAL_STATUSES.has(status.status)) {
        return status;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed + pollIntervalMs > maxTimeoutMs) {
        throw this.#createError(
          `Polling for job ${jobId} timed out after ${maxTimeoutMs}ms. Last status: ${status.status}`,
          HTTP_INTERNAL_SERVER_ERROR,
        );
      }

      this.log.info(`Job ${jobId} status: ${status.status}. Polling again in ${pollIntervalMs}ms...`);
      // eslint-disable-next-line no-await-in-loop
      await delay(pollIntervalMs);
    }
  }

  /**
   * Looks up previously retrieved URLs in the DRS data store.
   * @param {Object} requestBody - Lookup request body
   * @returns {Promise<Object>} Lookup results
   */
  async lookupUrls(requestBody) {
    return this.#sendRequest('POST', '/url-lookup', requestBody);
  }
}
