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

import { hasText, isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

function validateFirefallResponse(response) {
  if (!isObject(response) || !Array.isArray(response.insights)) {
    return false;
  }

  return response.insights.every((item) => item
    && typeof item === 'object'
    && typeof item.insight === 'string'
    && typeof item.recommendation === 'string'
    && typeof item.code === 'string');
}

export default class FirefallClient {
  static createFrom(context) {
    const { log } = context;
    const {
      FIREFALL_API_ENDPOINT: apiEndpoint,
      FIREFALL_IMS_ORG: imsOrg,
      FIREFALL_API_KEY: apiKey,
      FIREFALL_API_AUTH: apiAuth,
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

  async #apiCall(prompt) {
    const body = JSON.stringify({
      dialogue: {
        question: prompt,
      },
      llm_metadata: {
        max_tokens: 4000,
        llm_type: 'azure_chat_openai',
        model_name: 'gpt-4',
        temperature: 0.5,
      },
    });
    return fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiAuth}`,
        'x-api-key': this.config.apiKey,
        'x-gw-ims-org-id': this.config.imsOrg,
      },
      body,
    });
  }

  async fetch(prompt) {
    if (!hasText(prompt)) {
      throw new Error('Invalid prompt received');
    }

    try {
      const startTime = process.hrtime.bigint();
      const response = await this.#apiCall();
      this.#logDuration('Firefall API call', startTime);

      if (!response.ok) {
        this.log.error(`Firefall API returned status code ${response.status}`);
        throw new Error(`Firefall API returned status code ${response.status}`);
      }

      const responseData = await response.json();
      if (!responseData.generations?.[0]?.[0]) {
        this.log.error('Could not obtain data from Firefall: Generations object is missing.');
        throw new Error('Generations object is missing.');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseData.generations[0][0].text);
      } catch (e) {
        this.log.error('Returned Data from Firefall is not a JSON object.');
        throw new Error('Returned Data from Firefall is not a JSON object.');
      }

      if (!validateFirefallResponse(parsedResponse)) {
        this.log.error('Could not obtain data from Firefall: Invalid response format.');
        throw new Error('Invalid response format.');
      }
      return parsedResponse;
    } catch (error) {
      this.log.error('Error while fetching data from Firefall API: ', error.message);
      throw error;
    }
  }
}
