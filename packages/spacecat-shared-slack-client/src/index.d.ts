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

export interface TargetTokenPair {
  target: string;
  token: string;
}

export default class SlackClient {
  /**
   * Static factory method to create an instance of SlackClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of SlackClient.
   * @remarks This method is designed to create a new instance from an AWS Lambda context.
   *   The created instance is stored in the Lambda context, and subsequent calls to
   *   this method will return the singleton instance if previously created.
   */
  static createFrom(context: UniversalContext): SlackClient;

  /**
   * Constructor for creating an instance of SlackClient.
   * @param {string} targetTokenPairs - An array of target-token pairs which is
   * used to create slack api clients for each target.
   * @remarks token is specific to the Slack API.
   */
  constructor(targetTokenPairs: TargetTokenPair[]);

  /**
   * Asynchronous method to create a RUM backlink.
   * @param {string} target - A string representing the target slack workspace/org
   * @param {number} opts - An object containing the data sent to Slack API
   * @returns A Promise resolving to an object containing the data returned by Slack API
   */
  postMessage(target: string, opts: object): Promise<object>;
}
