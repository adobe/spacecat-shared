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
    const {
      FIREFALL_API_ENDPOINT: apiEndpoint,
      FIREFALL_IMS_ORG: imsOrg,
      FIREFALL_API_KEY: apiKey,
      FIREFALL_API_AUTH: apiAuth,
      FIREFALL_API_POLL_INTERVAL: pollInterval = 2000,
    } = context.env;

    if (!isValidUrl(apiEndpoint)) {
      throw new Error('Missing Firefall API endpoint');
    }

    if (!hasText(imsOrg)) {
      throw new Error('Missing Firefall IMS Org');
    }

    if (!hasText(apiKey)) {
      throw new Error('Missing Firefall API key');
    }

    if (!hasText(apiAuth)) {
      throw new Error('Missing Firefall API auth');
    }

    return new FirefallClient({
      apiEndpoint,
      imsOrg,
      apiKey,
      apiAuth,
      pollInterval,
    }, log);
  }

  /**
   * Creates a new Firefall client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.apiEndpoint - The API endpoint for Firefall.
   * @param {string} config.imsOrg - The IMS Org for Firefall.
   * @param {string} config.apiKey - The API Key for Firefall.
   * @param {string} config.apiAuth - The Bearer authorization token for Firefall.
   * @param {number} config.pollInterval - The interval to poll for job status.
   * @param {Object} log - The Logger.
   * @returns {FirefallClient} - the Firefall client.
   */
  constructor(config, log) {
    this.config = config;
    this.log = log;
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  async #submitJob(prompt) {
    const body = JSON.stringify({
      input: prompt,
      capability_name: 'gpt4_32k_completions_capability',
    });

    const url = createUrl(`${this.config.apiEndpoint}/v2/capability_execution/job`);
    const response = await httpFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiAuth}`,
        'x-api-key': this.config.apiKey,
        'x-gw-ims-org-id': this.config.imsOrg,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Job submission failed with status code ${response.status}`);
    }

    return response.json();
  }

  /* eslint-disable no-await-in-loop */
  async #pollJobStatus(jobId) {
    let jobStatusResponse;
    do {
      await new Promise(
        (resolve) => { setTimeout(resolve, this.config.pollInterval); },
      ); // Wait for 2 seconds before polling

      const response = await httpFetch(
        createUrl(`${this.config.apiEndpoint}/v2/capability_execution/job/${jobId}`),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiAuth}`,
            'x-api-key': this.config.apiKey,
            'x-gw-ims-org-id': this.config.imsOrg,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Job polling failed with status code ${response.status}`);
      }

      jobStatusResponse = await response.json();
    } while (jobStatusResponse.status === 'PROCESSING');

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
