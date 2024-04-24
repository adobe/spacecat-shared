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

// eslint-disable-next-line max-classes-per-file
import { UniversalContext } from '@adobe/helix-universal';
import { OAuth2Client } from 'google-auth-library';

export class GoogleClient {
  /**
   * Static factory method to create an instance of GoogleClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @param siteId - The site ID of the site to be audited
   * @returns An instance of GoogleClient.
   */
  static createFrom(context: UniversalContext, siteId: string): GoogleClient;

  /**
   * Constructor for creating an instance of GoogleClient.
   * @param config
   * @param log
   */
  constructor(config: object, log?: Console);

  /**
   * Decrypts an encrypted secret using the Google encryption key and IV.
   * @param {string} encrypted - The encrypted secret to be decrypted.
   * Must be a hex encoded string and encrypted using AES-256-CBC.
   * @returns {string} The decrypted secret.
   */
  decryptSecret(encrypted: string): string;

  /**
   * Encrypts a secret using the Google encryption key and IV
   * @param {string} secret - The secret to be encrypted using AES-256-CBC.
   * @returns {string} The encrypted secret as a hex encoded string.
   */
  encryptSecret(secret: string): string;

  /**
   * Generates an OAuth2 client for the Google Search Console API.
   * @returns {Promise<OAuth2Client>}
   */
  generateAuthClient(): Promise<OAuth2Client>;

  /**
   * Retrieves the Google Search Console data for the specified date range.
   * @param startDate - The start date of the date range.
   * @param endDate - The end date of the date range.
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
  getOrganicSearchData(startDate: Date, endDate: Date): Promise<Response>;
}

export class CustomerSecrets {
  constructor(region: string, log?: Console);

  storeToken(secretName: string, tokenValue:string): void;

  updateTokens(secretName: string, tokenValue:string): void;

  retrieveTokens(secretName: string): string;
}
