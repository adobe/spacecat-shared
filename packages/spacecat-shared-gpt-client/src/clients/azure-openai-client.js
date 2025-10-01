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
import { hasText, isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { fetch as httpFetch, sanitizeHeaders } from '../utils.js';

const USER_ROLE_IMAGE_URL_TYPE = 'image_url';
const USER_ROLE_TEXT_TYPE = 'text';
const SYSTEM_ROLE = 'system';
const USER_ROLE = 'user';
const JSON_OBJECT_RESPONSE_FORMAT = 'json_object';

function validateChatCompletionResponse(response) {
  return isObject(response)
    && Array.isArray(response?.choices)
    && response.choices.length > 0
    && response.choices[0]?.message;
}

function isBase64UrlImage(base64String) {
  return base64String.startsWith('data:image') && base64String.endsWith('=') && base64String.includes('base64');
}

export default class AzureOpenAIClient {
  static createFrom(context) {
    const { log = console } = context;

    const {
      AZURE_OPENAI_ENDPOINT: apiEndpoint,
      AZURE_OPENAI_KEY: apiKey,
      AZURE_API_VERSION: apiVersion,
      AZURE_COMPLETION_DEPLOYMENT: deploymentName,
    } = context.env;

    if (!isValidUrl(apiEndpoint)) {
      throw new Error('Missing Azure OpenAI API endpoint');
    }

    if (!hasText(apiKey)) {
      throw new Error('Missing Azure OpenAI API key');
    }

    if (!hasText(apiVersion)) {
      throw new Error('Missing Azure OpenAI API version');
    }

    if (!hasText(deploymentName)) {
      throw new Error('Missing Azure OpenAI deployment name');
    }

    return new AzureOpenAIClient({
      apiEndpoint,
      apiKey,
      apiVersion,
      deploymentName,
    }, log);
  }

  /**
   * Creates a new Azure OpenAI client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.apiEndpoint - The API endpoint for Azure OpenAI.
   * @param {string} config.apiKey - The API Key for Azure OpenAI.
   * @param {string} config.apiVersion - The API version for Azure OpenAI.
   * @param {string} config.deploymentName - The deployment name for Azure OpenAI.
   * @param {Object} log - The Logger.
   * @returns {AzureOpenAIClient} - the Azure OpenAI client.
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

  /**
   * Submit a prompt to the Azure OpenAI API.
   * @param body The body of the request.
   * @param path The Azure OpenAI API path.
   * @returns {Promise<unknown>}
   */
  async #submitPrompt(body, path) {
    const url = createUrl(`${this.config.apiEndpoint}${path}?api-version=${this.config.apiVersion}`);
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
    };

    this.log.debug(`[Azure OpenAI API Call]: ${url}, Headers: ${JSON.stringify(sanitizeHeaders(headers))}`);

    const response = await httpFetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API call failed with status code ${response.status} and body: ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Fetches data from Azure OpenAI Chat Completion API.
   * @param prompt The text prompt to provide to Azure OpenAI
   * @param options The options for the call, with optional properties:
   *          - imageUrls: An array of URLs of the images to provide to Azure OpenAI
   *          - responseFormat: The response format to request from Azure OpenAI
   *            (accepts: json_object)
   * @returns {Object} - AI response
   */
  async fetchChatCompletion(prompt, options = {}) {
    const {
      imageUrls,
      responseFormat,
      systemPrompt,
    } = options || {};
    const hasImageUrls = imageUrls && imageUrls.length > 0;

    const getBody = () => {
      const userRole = {
        role: USER_ROLE,
        content: [
          {
            type: USER_ROLE_TEXT_TYPE,
            text: prompt,
          },
        ],
      };

      if (hasImageUrls) {
        imageUrls
          .filter((iu) => isValidUrl(iu) || isBase64UrlImage(iu))
          .forEach((imageUrl) => {
            userRole.content.push({
              type: USER_ROLE_IMAGE_URL_TYPE,
              image_url: {
                url: imageUrl,
              },
            });
          });
      }

      const body = {
        messages: [
          userRole,
        ],
      };

      if (systemPrompt) {
        body.messages.unshift({
          role: SYSTEM_ROLE,
          content: systemPrompt,
        });
      } else if (responseFormat === JSON_OBJECT_RESPONSE_FORMAT) {
        body.response_format = {
          type: JSON_OBJECT_RESPONSE_FORMAT,
        };
        body.messages.unshift({
          role: SYSTEM_ROLE,
          content: 'You are a helpful assistant designed to output JSON.',
        });
      }

      return body;
    };

    // Validate inputs
    if (!hasText(prompt)) {
      throw new Error('Invalid prompt received');
    }
    if (hasImageUrls && !Array.isArray(imageUrls)) {
      throw new Error('imageUrls must be an array.');
    }

    let chatSubmissionResponse;
    try {
      const startTime = process.hrtime.bigint();
      const body = getBody();

      chatSubmissionResponse = await this.#submitPrompt(JSON.stringify(body), `/openai/deployments/${this.config.deploymentName}/chat/completions`);
      this.#logDuration('Azure OpenAI API Chat Completion call', startTime);
    } catch (error) {
      this.log.error('Error while fetching data from Azure OpenAI chat API: ', error.message);
      throw error;
    }

    if (!validateChatCompletionResponse(chatSubmissionResponse)) {
      this.log.error(
        'Could not obtain data from Azure OpenAI: Invalid response format.',
      );
      throw new Error('Invalid response format.');
    }
    if (!chatSubmissionResponse.choices.some((ch) => hasText(ch?.message?.content))) {
      throw new Error('Prompt completed but no output was found.');
    }

    return chatSubmissionResponse;
  }
}
