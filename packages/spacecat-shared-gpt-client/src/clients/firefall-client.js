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
import { ImsClient } from '@adobe/spacecat-shared-ims-client';
import { hasText, isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { fetch as httpFetch } from '../utils.js';

function validateFirefallResponse(response) {
  return !(!isObject(response)
    || !Array.isArray(response.generations)
    || response.generations.length === 0
    || !Array.isArray(response.generations[0])
    || !isObject(response.generations[0][0])
    || !hasText(response.generations[0][0].text));
}

export default class FirefallClient {
  static createFrom(context) {
    const { log = console } = context;
    const imsClient = ImsClient.createFrom(context);

    const {
      FIREFALL_API_ENDPOINT: apiEndpoint,
      IMS_CLIENT_ID: imsOrg,
      FIREFALL_API_KEY: apiKey,
      FIREFALL_API_POLL_INTERVAL: pollInterval = 2000,
      FIREFALL_API_CAPABILITY_NAME: capabilityName = 'gpt4_32k_completions_capability',
    } = context.env;

    if (!isValidUrl(apiEndpoint)) {
      throw new Error('Missing Firefall API endpoint');
    }

    if (!hasText(apiKey)) {
      throw new Error('Missing Firefall API key');
    }

    return new FirefallClient({
      apiEndpoint,
      apiKey,
      capabilityName,
      imsClient,
      imsOrg,
      pollInterval,
    }, log);
  }

  /**
   * Creates a new Firefall client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.apiEndpoint - The API endpoint for Firefall.
   * @param {string} config.apiKey - The API Key for Firefall.
   * @param {string} config.capabilityName - The capability name for Firefall.
   * @param {ImsClient} config.imsClient - The IMS Client.
   * @param {string} config.imsOrg - The IMS Org for Firefall.
   * @param {number} config.pollInterval - The interval to poll for job status.
   * @param {Object} log - The Logger.
   * @returns {FirefallClient} - the Firefall client.
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

  async #submitJob(prompt) {
    const apiAuth = await this.#getApiAuth();

    const body = JSON.stringify({
      input: prompt,
      capability_name: this.config.capabilityName,
    });

    const url = createUrl(`${this.config.apiEndpoint}/v2/capability_execution/job`);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiAuth}`,
      'x-api-key': this.config.apiKey,
      'x-gw-ims-org-id': this.config.imsOrg,
    };

    this.log.info(`URL: ${url}, Headers: ${JSON.stringify(headers)}`);

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
  async #pollJobStatus(jobId) {
    const apiAuth = await this.#getApiAuth();

    let jobStatusResponse;
    do {
      await new Promise(
        (resolve) => { setTimeout(resolve, this.config.pollInterval); },
      ); // Wait for 2 seconds before polling

      const url = `${this.config.apiEndpoint}/v2/capability_execution/job/${jobId}`;
      const headers = {
        Authorization: `Bearer ${apiAuth}`,
        'x-api-key': this.config.apiKey,
        'x-gw-ims-org-id': this.config.imsOrg,
      };

      this.log.info(`URL: ${url}, Headers: ${JSON.stringify(headers)}`);

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
    } while (jobStatusResponse.status === 'PROCESSING' || jobStatusResponse.status === 'WAITING');

    if (jobStatusResponse.status !== 'SUCCEEDED') {
      throw new Error(`Job did not succeed, status: ${jobStatusResponse.status}`);
    }

    return jobStatusResponse;
  }

  async fetch(prompt) {
    if (!hasText(prompt)) {
      throw new Error('Invalid prompt received');
    }

    try {
      const startTime = process.hrtime.bigint();
      const jobSubmissionResponse = await this.#submitJob(prompt);
      const jobStatusResponse = await this.#pollJobStatus(jobSubmissionResponse.job_id);
      this.#logDuration('Firefall API call', startTime);

      const { output } = jobStatusResponse;
      if (!output || !output.capability_response) {
        throw new Error('Job completed but no output was found');
      }

      if (!validateFirefallResponse(output.capability_response)) {
        this.log.error('Could not obtain data from Firefall: Invalid response format.');
        throw new Error('Invalid response format.');
      }

      const result = output.capability_response.generations[0][0];

      this.log.info(`Generation Info: ${JSON.stringify(result.generation_info)}`);
      this.log.info(`LLM Info: ${JSON.stringify(output.capability_response.llm_output)}`);

      return result.text;
    } catch (error) {
      this.log.error('Error while fetching data from Firefall API: ', error.message);
      throw error;
    }
  }
}
