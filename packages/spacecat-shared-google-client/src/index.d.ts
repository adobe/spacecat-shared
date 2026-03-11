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

import { OAuth2Client } from 'google-auth-library';

export default class GoogleClient {
  /**
   * Static factory method to create an instance of GoogleClient.
   *
   * @param {object} context - An object containing the AWS Lambda context information
   * @param {string} url - The URL of the site to be audited.
   * @returns An instance of GoogleClient.
   */
  static createFrom(context: object, url: string): Promise<GoogleClient>;

  /**
   * Constructor for creating an instance of GoogleClient.
   * @param {OAuth2Client} authClient - The OAuth2 google client.
   * @param log - The log object.
   */
  constructor(authClient: OAuth2Client, log?: Console);

  /**
   * Retrieves the Google Search Console data for the specified date range.
   *
   * @param {Date} startDate - The start date of the date range.
   * @param {Date} endDate - The end date of the date range.
   * @param {Array} dimensions - The dimensions to be included in the report.
   * this parameter is optional and defaults to ['date'],
   * which means that the report will be grouped by date.
   * @param {Number} rowLimit - The maximum number of rows to return, defaults to 1000.
   * @param {Number} startRow - The row number to start from, defaults to 0.
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
    startDate: Date,
    endDate: Date,
    dimensions?: string[],
    rowLimit?: number,
    startRow?: number
  ): Promise<JSON>;

  /**
   * Retrieves the Google Search Console data for the specified url.
   * @param url - The URL of the site to be inspected
   * @returns {Promise<JSON>} The Google Search Console data.
   */
  urlInspect(url: string): Promise<JSON>;

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

  /**
   * Retrieves the current Chrome UX report for a given url and form factors
   * @see https://developer.chrome.com/docs/crux/api
   * @param url the url to get the Chrome UX report for
   * @param formFactor the form factor to get the Chrome UX report for.
   * Should be one of 'PHONE', 'DESKTOP',  or 'TABLET'
   * @returns {Promise<Object>} the Chrome UX report data for the requested url and form factor
   */
  getChromeUXReport(url: string, formFactor?: string): Promise<JSON>;

  /**
   * Retrieves the current Page Speed Insights for a given url and strategy and category
   * @see https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed
   * @param url the url to get the Page Speed Insights for
   * @param strategy the strategy to get the Page Speed Insights for.
   * Should be 'mobile' or 'desktop', defaults to 'mobile'
   * @param category the category to get the Page Speed Insights for.
   * Should be one of 'performance', 'accessibility', 'best-practices', 'seo', or 'pwa',
   * defaults to 'performance'
   * @returns {Promise<JSON>}
   * the Page Speed Insights data for the requested url and strategy and category
   */
  getPageSpeedInsights(url: string, strategy?: string, category?: string): Promise<JSON>;
}
