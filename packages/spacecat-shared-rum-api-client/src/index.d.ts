/*
 * Copyright 2023 Adobe. All rights reserved.
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

export declare class RUMAPIClient {
  /**
   * Static factory method to create an instance of RUMAPIClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of RUMAPIClient.
   * @remarks This method is designed to create a new instance from an AWS Lambda context.
   *   The created instance is stored in the Lambda context, and subsequent calls to
   *   this method will return the singleton instance if previously created.
   */
  static createFrom(context: UniversalContext): RUMAPIClient;

  /**
   * Constructor for creating an instance of RUMAPIClient.
   * @param {string} domainkey - A string parameter representing the domain key of the RUM API.
   *   This key is used to authenticate and interact with the RUM API.
   * @remarks The domain key is specific to the RUM API.
   */
  constructor(domainkey: string);

  /**
   * Asynchronous method to create a backlink.
   * @param {string} url - A string representing the URL for the backlink.
   * @param {number} expiry - An integer representing the expiry value for the backlink.
   * @returns A Promise resolving to a string representing url of the created backlink.
   * @remarks This method creates a backlink to the RUM dashboard, allowing users
   *   to view their reports and monitor real user activities.
   */
  createBacklink(url: string, expiry: number): Promise<string>;
}
