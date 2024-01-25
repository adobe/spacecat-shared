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

import { UniversalContext } from '@adobe/helix-universal';

export default class SlackClient {
  /**
   * Static factory method to create an instance of SlackClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @param {string} target - A string representing the target slack workspace/org
   * @returns An instance of SlackClient.
   * @remarks This method is designed to create a new instance from an AWS Lambda context.
   *   The created instance is stored in the Lambda context, and subsequent calls to
   *   this method will return the singleton instance if previously created.
   */
  static createFrom(context: UniversalContext, target: string): SlackClient;

  /**
   * Constructor for creating an instance of SlackClient.
   * @param {string} token - slack bot token
   * @param {object} log - a logger object
   * used to create slack api clients for each target.
   * @remarks token is specific to the Slack API.
   */
  constructor(token: string, log: object);

  /**
   * Asynchronous method to create a RUM backlink.

   * @param {object} message - Message payload to be sent to Slack API. see https://api.slack.com/methods/chat.postMessage
   * @returns A Promise resolving to an object containing the data returned by Slack API
   */
  postMessage(message: object): Promise<object>;

  /**
   * Asynchronous method to create a RUM backlink.

   * @param {object} file - An object containing file payload and metadata to be sent to Slack API. see https://slack.dev/node-slack-sdk/web-api#new-way
   * @returns A Promise resolving to an object containing the data returned by Slack API
   */
  fileUpload(file: object): Promise<object>;
}
