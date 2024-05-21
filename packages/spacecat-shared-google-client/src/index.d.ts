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
   *
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @param {string} url - The URL of the site to be audited.
   * @returns An instance of GoogleClient.
   */
  static createFrom(context: UniversalContext, url: string): GoogleClient;

  /**
   * Constructor for creating an instance of GoogleClient.
   * @param {OAuth2Client} authClient - The OAuth2 google client.
   * @param log - The log object.
   */
  constructor(authClient: OAuth2Client, log?: Console);

  /**
   * Retrieves the Google Search Console data for the specified date range.
   *
   * @param baseURL - The base URL of the site to be audited.
   * @param startDate - The start date of the date range.
   * @param endDate - The end date of the date range.
   * @param dimensions - The dimensions to be included in the report.
   * this parameter is optional and defaults to ['date'],
   * which means that the report will be grouped by date.
   * @returns {Promise<JSON>} The Google Search Console data.
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
  getOrganicSearchData(
    baseURL: string,
    startDate: Date,
    endDate: Date,
    dimensions: string[]
  ): Promise<JSON>;

  /**
   * Lists all sites available to the authenticated user in Google Search Console.
   *
   * @returns {Promise<JSON>} A promise that resolves to the result of the list sites operation.
   * @throws {Error} If an error occurs while retrieving the sites.
   * Format: {
   *  "data": {
   *    "siteEntry": [
   *      {
   *       "siteUrl": string,
   *       "permissionLevel": string
   *      }
   *    ]
   *  }
   *}
   * */
  listSites(): Promise<JSON>;
}
