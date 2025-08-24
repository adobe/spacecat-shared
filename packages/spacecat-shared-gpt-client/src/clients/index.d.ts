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

import type { UniversalContext } from '@adobe/helix-universal';

export class FirefallClient {
  /**
   * Creates a new FirefallClient instance from the given UniversalContext.
   * @param {UniversalContext} context The UniversalContext to use for creating the FirefallClient.
   * @returns {FirefallClient} The FirefallClient instance.
   */
  static createFrom(context: UniversalContext): FirefallClient;

  /**
   * Sends the given prompt to the Firefall GPT API and returns the response.
   * @param {string} prompt The prompt to send to the Firefall GPT API.
   * @returns {Promise<string>} The response from the Firefall GPT API.
   * @deprecated since version 1.2.19. Use fetchCapabilityExecution instead.
   */
  fetch(prompt: string): Promise<string>;

  /**
   * Fetches data from Firefall Chat Completion API.
   *
   * @param {string} prompt - The text prompt to provide to Firefall
   * @param {object} [options] - The options for the call, with optional properties:
   * - imageUrls: An array of URLs of the images to provide to Firefall
   * - model: LLM Model to use (default: gpt-4-turbo).
   * Use 'gpt-4-vision' with images.
   * JSON mode is only currently supported with the following models: gpt-35-turbo-1106, gpt-4-turbo
   * @returns {Promise<object>} A promise that resolves to an object containing the chat completion.
   *
   * The returned object has the following structure:
   *
   * @example
   * {
   *   "conversation_identifier": string | null,
   *   "query_id": string | null,
   *   "model": string,
   *   "choices": [
   *     {
   *       "finish_reason": string,
   *       "index": number,
   *       "message": {
   *         "role": string,
   *         "content": string,
   *         "function_call": object | null
   *       },
   *       "content_filter_results": {
   *         "hate": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "self_harm": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "sexual": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "violence": {
   *           "filtered": boolean,
   *           "severity": string
   *         }
   *       },
   *       "logprobs": object | null
   *     }
   *   ],
   *   "created_at": string,
   *   "usage": {
   *     "completion_tokens": number,
   *     "prompt_tokens": number,
   *     "total_tokens": number
   *   },
   *   "prompt_filter_results": [
   *     {
   *       "prompt_index": number,
   *       "content_filter_results": {
   *         "hate": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "jailbreak": {
   *           "filtered": boolean,
   *           "detected": boolean
   *         },
   *         "self_harm": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "sexual": {
   *           "filtered": boolean,
   *           "severity": string
   *         },
   *         "violence": {
   *           "filtered": boolean,
   *           "severity": string
   *         }
   *       }
   *     }
   *   ]
   * }
   */
  fetchChatCompletion(prompt: string, options?: object): Promise<object>;

  /**
   * Fetches data from Firefall API.
   * @param prompt The text prompt to provide to Firefall
   * @returns {Promise<string>} - AI response
   */
  fetchCapabilityExecution(prompt: string): Promise<string>;
}

export class AzureOpenAIClient {
  /**
   * Creates a new AzureOpenAIClient instance from the given UniversalContext.
   * @param {UniversalContext} context The UniversalContext to use for creating the AzureOpenAIClient.
   * @returns {AzureOpenAIClient} The AzureOpenAIClient instance.
   */
  static createFrom(context: UniversalContext): AzureOpenAIClient;

  /**
   * Fetches data from Azure OpenAI Chat Completion API.
   *
   * @param {string} prompt - The text prompt to provide to Azure OpenAI
   * @param {object} [options] - The options for the call, with optional properties:
   * - imageUrls: An array of URLs of the images to provide to Azure OpenAI
   * - responseFormat: The response format to request from Azure OpenAI (accepts: json_object)
   * @returns {Promise<object>} A promise that resolves to an object containing the chat completion.
   *
   * The returned object has the following structure:
   *
   * @example
   * {
   *   "id": string,
   *   "object": string,
   *   "created": number,
   *   "model": string,
   *   "choices": [
   *     {
   *       "index": number,
   *       "message": {
   *         "role": string,
   *         "content": string
   *       },
   *       "finish_reason": string
   *     }
   *   ],
   *   "usage": {
   *     "prompt_tokens": number,
   *     "completion_tokens": number,
   *     "total_tokens": number
   *   }
   * }
   */
  fetchChatCompletion(prompt: string, options?: {
    imageUrls?: string[];
    responseFormat?: string;
  }): Promise<object>;
}
