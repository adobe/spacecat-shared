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
import { OAuth2Client } from 'google-auth-library';

export default class GoogleClient {
  /**
   * Static factory method to create an instance of GoogleClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @param {object} config - The configuration object:
   * {
   *   ACCESS_TOKEN: string,
   *   REFRESH_TOKEN: string,
   *   EXPIRATION: number,
   * }
   * @returns An instance of GoogleClient.
   */
  static createFrom(context: UniversalContext, config: object): GoogleClient;

  /**
   * Constructor for creating an instance of GoogleClient.
   * @param {OAuth2Client} authClient - The OAuth2 google client.
   * @param log - The log object.
   */
  constructor(authClient: OAuth2Client, log?: Console);

  /**
   * Retrieves the Google Search Console data for the specified date range.
   * @param baseURL - The base URL of the site to be audited.
   * @param startDate - The start date of the date range.
   * @param endDate - The end date of the date range.
   * @param rowLimit - The maximum number of rows to return.
   * @param startRow - The row number to start from.
   * @returns {Promise<Response>} The Google Search Console data.
   * Format: {
   *   "rows": [
   *     {
   *       "keys": [
   *         string
   *       ],
   *       "clicks": double,
   *       "impressions": double,
   *       "ctr": double,
   *       "position": double
   *     }
   *   ],
   *   "responseAggregationType": string
   * }
   */
  getOrganicSearchData(baseURL: string, startDate: Date, endDate: Date): Promise<Response>;

  listSites(googleClient: OAuth2Client): Promise<Response>;
}
