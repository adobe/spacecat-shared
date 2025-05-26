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

export interface AhrefsAPIOptions {
    select: string;
    where: string;
    order_by: string;
    date: string;
    target: string;
    limit: number;
    mode: string;
    output: string;
}

export default class AhrefsAPIClient {
  /**
   * Static factory method to create an instance of AhrefsAPIClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of AhrefsAPIClient.
   */
  static createFrom(context: UniversalContext): AhrefsAPIClient;

  /**
    * Constructor for creating an instance of AhrefsAPIClient.
    * @param config
    * @param fetchAPI
    * @param log
    */
  constructor(config: object, fetchAPI, log?: Console);

  /**
     * Asynchronous method to send a request to the Ahrefs API.
     * @param endpoint
     * @param queryParams
     */
  sendRequest(endpoint: string, queryParams?: AhrefsAPIOptions):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
     * Asynchronous method to get broken backlinks.
     * @param url
     * @param limit
     */
  getBrokenBacklinks(url: string, limit?: number):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
     * Asynchronous method to get top pages.
     * @param url
     * @param limit
     */
  getTopPages(url: string, limit?: number):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
     * Asynchronous method to get backlinks.
     * @param url
     * @param limit
     */
  getBacklinks(url: string, limit?: number):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
   * Asynchronous method to get organic keywords.
   */
  getOrganicKeywords(
    url: string,
    options?: {
      country?: string,
      keywordFilter?: string[],
      limit?: number,
      mode?: 'exaxt' | 'prefix',
      excludeBranded?: boolean,
    }):
      Promise<{ result: object, fullAuditRef: string }>;
}
