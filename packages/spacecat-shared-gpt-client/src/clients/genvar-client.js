/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { ImsClient } from '@adobe/spacecat-shared-ims-client';
import { isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { fetch as httpFetch } from '../utils.js';

export default class GenvarClient {
  static createFrom(context) {
    const { log = console } = context;
    const imsClient = ImsClient.createFrom(context);
    const {
      GENVAR_HOST: genvarHost,
      GENVAR_IMS_ORG_ID: genvarImsOrgId,
      GENVAR_API_POLL_INTERVAL: pollInterval = 3000,
      GENVAR_METATAGS_API_ENDPOINT: metatagsApiEndpoint = '/api/v1/web/aem-genai-variations-appbuilder/metatags',
    } = context.env;

    if (!isValidUrl(genvarHost)) {
      throw new Error('Missing Genvar API endpoint');
    }

    return new GenvarClient({
      genvarHost,
      imsClient,
      imsOrg: genvarImsOrgId,
      pollInterval,
      metatagsApiEndpoint,
    }, log);
  }

  /**
   * Creates a new Genvar client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.apiEndpoint - The API endpoint for Genvar.
   * @param {ImsClient} config.imsClient - The IMS Client.
   * @param {string} config.imsOrg - The IMS Org for Genvar.
   * @param {number} config.pollInterval - The interval to poll for job status.
   * @param {Object} log - The Logger.
   * @returns {GenvarClient} - the Genvar client.
   */
  constructor(config, log) {
    this.config = config;
    this.log = log;
    this.imsClient = config.imsClient;
    this.apiAuth = null;
  }

  async #getApiAuth() {
    if (!this.apiAuth) {
      this.apiAuth = (await this.imsClient.getServiceAccessToken()).access_token;
    }
    return this.apiAuth;
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  async #submitJob(body, path) {
    const apiAuth = await this.#getApiAuth();
    const url = createUrl(`${this.config.genvarHost}${path}`);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiAuth}`,
      'x-gw-ims-org-id': this.config.imsOrg,
    };

    this.log.info(`[Genvar API Call] URL: ${url}, Headers: ${JSON.stringify({ ...headers, Authorization: '***' })}`);

    const response = await httpFetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`Job submission failed with status code ${response.status}`);
    }
    return response.json();
  }

  /* eslint-disable no-await-in-loop */
  async #pollJobStatus(jobId, path) {
    const apiAuth = await this.#getApiAuth();
    let jobStatusResponse;
    do {
      await new Promise(
        (resolve) => { setTimeout(resolve, this.config.pollInterval); },
      ); // Wait for 3 seconds(default) before polling

      const url = `${this.config.genvarHost}${path}?jobId=${jobId}`;
      const headers = {
        Authorization: `Bearer ${apiAuth}`,
        'x-gw-ims-org-id': this.config.imsOrg,
      };

      this.log.info(`[Genvar API Call] URL: ${url}, Headers: ${JSON.stringify({ ...headers, Authorization: '***' })}`);

      const response = await httpFetch(
        createUrl(url),
        {
          method: 'GET',
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Job polling failed with status code ${response.status}`);
      }
      jobStatusResponse = await response.json();
    } while (jobStatusResponse.status === 'running');

    if (jobStatusResponse.status !== 'completed') {
      throw new Error(`Job did not succeed, status: ${jobStatusResponse.status}.\n${JSON.stringify(jobStatusResponse, null, 2)}`);
    }

    return jobStatusResponse;
  }

  /**
   * Fetches data from Genvar API. Follows the flow: submit job and polls job status
   * @param body The request body to provide to Genvar
   * @param path The Genvar request path
   * @returns {string} - API Response
   */
  async generateSuggestions(body, path) {
    if (!body) {
      throw new Error('Invalid body received');
    }
    if (!path) {
      throw new Error('Invalid path received');
    }
    try {
      const startTime = process.hrtime.bigint();

      const jobSubmissionResponse = await this.#submitJob(body, path);
      const jobStatusResponse = await this.#pollJobStatus(jobSubmissionResponse.job_id, path);
      this.#logDuration('Genvar API Execution call took ms: ', startTime);

      const { result } = jobStatusResponse;
      if (!isObject(result)) {
        throw new Error('Job completed but no output was found');
      }
      return result;
    } catch (error) {
      this.log.error('Error while calling Genvar API: ', error.message);
      throw error;
    }
  }
}
