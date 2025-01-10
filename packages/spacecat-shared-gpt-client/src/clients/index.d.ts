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
   * @param prompt The text prompt to provide to Firefall
   * @param options The options for the call, with optional properties:
   *          - imageUrls: An array of URLs of the images to provide to Firefall
   *          - model: LLM Model to use (default: gpt-4-turbo).  Use 'gpt-4-vision' with images.
   *          - responseFormat: The response format to request from Firefall (accepts: json_object)
    * @returns {Promise<Object>} - AI response
   */
  fetchChatCompletion(prompt: string, options?: object): Promise<object>;

  /**
   * Fetches data from Firefall API.
   * @param prompt The text prompt to provide to Firefall
   * @returns {Promise<string>} - AI response
   */
  fetchCapabilityExecution(prompt: string): Promise<string>;
}
