/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createUrl } from '@adobe/fetch';
import {
  hasText, tracingFetch, isObject,
} from '@adobe/spacecat-shared-utils';
import { createFormData } from '../utils.js';

export default class ImsBaseClient {
  // Retry at most 2 times (3 total attempts) to avoid flooding IMS with requests.
  static #MAX_RETRIES = 2;

  // Base delay in ms; doubles each attempt: 1 000 ms → 2 000 ms.
  static #RETRY_BASE_DELAY_MS = 1000;

  /**
   * Creates a new Ims client
   *
   * @param {Object} config - The configuration object.
   * @param {Object} log - The Logger.
   * @returns {ImsClient} - the Ims client.
   */
  constructor(config, log) {
    this.config = config;
    this.log = log;
    // Exposed as an instance property so tests can override it without fake timers.
    this.retryBaseDelayMs = ImsBaseClient.#RETRY_BASE_DELAY_MS;
  }

  static #isRetryableStatus(status) {
    // Retry on server errors and rate limiting; never on client errors.
    return status === 429 || status >= 500;
  }

  static #sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Prepares the headers for an IMS API request
   *
   * @param {Object} options - Options for header preparation
   * @param {boolean} options.noContentType - If true, no Content-Type header will be added
   * @param {boolean} options.noAuth - If true, no Authorization header will be added
   * @param {string} options.accessToken - Optional access token to use instead of the service token
   * @param {Object} options.headers - Additional headers to include
   * @returns {Promise<Object>} The prepared headers
   */
  async #prepareImsRequestHeaders(options = {}) {
    const {
      noContentType = false, noAuth = false, accessToken, headers = {},
    } = options;

    const result = {
      ...(noContentType ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    };

    if (!noAuth) {
      if (hasText(accessToken)) {
        // Use the provided access token
        result.Authorization = `Bearer ${accessToken}`;
      } else {
        // Use the service token
        const imsToken = await this.getServiceAccessToken();
        result.Authorization = `Bearer ${imsToken.access_token}`;
      }
    }

    return result;
  }

  async #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  /**
   * Makes an API call to IMS endpoints
   *
   * @param {string} endpoint - The IMS endpoint path
   * @param {Object} queryString - Query parameters
   * @param {Object|null} body - Body parameters for POST requests
   * @param {Object} [options] - Optional parameters
   * @param {string} [options.accessToken] - Optional access token to use instead of the
   * service token
   * @param {boolean} [options.noAuth] - If true, no Authorization header will be added
   * @param {boolean} [options.noContentType] - If true, no Content-Type header will be added
   * @param {Object} [options.headers] - Optional additional headers to include
   * @returns {Promise<Response>} - The fetch response
   */
  // eslint-disable-next-line consistent-return
  async imsApiCall(
    endpoint,
    queryString = {},
    body = null,
    options = {},
  ) {
    const startTime = process.hrtime.bigint();
    const maxAttempts = ImsBaseClient.#MAX_RETRIES + 1;

    const headers = await this.#prepareImsRequestHeaders(options);
    const url = createUrl(`https://${this.config.imsHost}${endpoint}`, queryString);
    const fetchOptions = {
      ...(isObject(body) ? { method: 'POST' } : { method: 'GET' }),
      headers,
      ...(isObject(body) ? { body: createFormData(body) } : {}),
    };

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await tracingFetch(url, fetchOptions);

        const shouldRetry = ImsBaseClient.#isRetryableStatus(response.status)
          && attempt < ImsBaseClient.#MAX_RETRIES;
        if (shouldRetry) {
          const delay = this.retryBaseDelayMs * (2 ** attempt);
          this.log.warn(
            `IMS ${endpoint} request returned status ${response.status} `
            + `(attempt ${attempt + 1}/${maxAttempts}). `
            + `Retrying in ${delay}ms...`,
          );
          // eslint-disable-next-line no-await-in-loop
          await ImsBaseClient.#sleep(delay);
          continue; // eslint-disable-line no-continue
        }

        const callerName = new Error().stack.split('\n')[2].trim().split(' ')[1];
        this.#logDuration(`IMS ${callerName} request`, startTime);

        if (attempt > 0) {
          this.log.info(
            `IMS ${endpoint} request succeeded on attempt ${attempt + 1}/${maxAttempts} `
            + `(used ${attempt} ${attempt === 1 ? 'retry' : 'retries'}).`,
          );
        }

        return response;
      } catch (error) {
        if (attempt < ImsBaseClient.#MAX_RETRIES) {
          const delay = this.retryBaseDelayMs * (2 ** attempt);
          this.log.warn(
            `IMS ${endpoint} request failed with network error `
            + `(attempt ${attempt + 1}/${maxAttempts}): ${error.message}. `
            + `Retrying in ${delay}ms...`,
          );
          // eslint-disable-next-line no-await-in-loop
          await ImsBaseClient.#sleep(delay);
        } else {
          this.log.error(
            `IMS ${endpoint} request failed after ${maxAttempts} attempts: ${error.message}`,
          );
          throw error;
        }
      }
    }
  }
}
