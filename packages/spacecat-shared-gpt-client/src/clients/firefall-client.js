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

function templatePrompt(prompt, context) {
  return prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
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
    this.apiBaseUrl = `${config.apiEndpoint}/v2/`;
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

  async #apiCall(path, method, body = null) {
    const apiAuth = await this.#getApiAuth();
    const url = `${this.apiBaseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiAuth}`,
      'x-api-key': this.config.apiKey,
      'x-gw-ims-org-id': this.config.imsOrg,
    };

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    this.log.info(`URL: ${url}, Headers: ${JSON.stringify(headers)}`);

    const response = await httpFetch(createUrl(url), options);

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`API call failed with status code ${response.status}: ${msg}`);
    }

    return response.json();
  }

  async #submitJob(prompt) {
    const path = 'capability_execution/job';
    const body = {
      input: prompt,
      capability_name: this.config.capabilityName,
    };

    return this.#apiCall(path, 'POST', body);
  }

  /* eslint-disable no-await-in-loop */
  async #pollJobStatus(jobId) {
    let jobStatusResponse;
    do {
      await new Promise(
        (resolve) => { setTimeout(resolve, this.config.pollInterval); },
      ); // Wait for pollInterval before polling

      const url = `capability_execution/job/${jobId}`;
      jobStatusResponse = await this.#apiCall(url, 'GET');
    } while (jobStatusResponse.status === 'PROCESSING' || jobStatusResponse.status === 'WAITING');

    if (jobStatusResponse.status !== 'SUCCEEDED') {
      throw new Error(`Job did not succeed, status: ${jobStatusResponse.status}.\n${JSON.stringify(jobStatusResponse, null, 2)}`);
    }

    return jobStatusResponse;
  }

  async #createConversationSession() {
    const url = 'conversation';
    const body = { capability_name: this.config.capabilityName, conversation_name: 'spacecat' };

    const response = await this.#apiCall(url, 'POST', body);
    return response.conversation_id;
  }

  async #submitPromptToConversation(sessionId, prompt) {
    const path = 'query';
    const body = { dialogue: { question: prompt }, conversation_id: sessionId };

    return this.#apiCall(path, 'POST', body);
  }

  async executePromptChain(chainConfig) {
    const sessionId = await this.#createConversationSession();

    let context = {};
    for (const step of chainConfig.steps) {
      const prompt = templatePrompt(step.prompt, context);
      const response = await this.#submitPromptToConversation(sessionId, prompt);
      const { answer } = response.dialogue;

      if (step.onResponse) {
        const result = step.onResponse(answer, context);
        if (result.abort) {
          this.log.info('Prompt chain aborted.');
          break;
        }
        context = { ...context, ...result.context };
      } else {
        context = { ...context, ...response };
      }
    }
    return context;
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
