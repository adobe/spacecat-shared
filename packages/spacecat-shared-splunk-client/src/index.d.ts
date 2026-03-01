/*
 * Copyright 2025 Adobe. All rights reserved.
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

export interface SplunkAPIOptions {
  select: string;
  where: string;
  order_by: string;
  date: string;
  target: string;
  limit: number;
  mode: string;
  output: string;
}
export type SplunkLoginResult =
  | { sessionId: string; cookie: string }
  | { error: unknown };

export interface SplunkOneshotResponse {
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export default class SplunkAPIClient {
  /**
   * Static factory method to create an instance of SplunkAPIClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of SplunkAPIClient.
   */
  static createFrom(context: UniversalContext): SplunkAPIClient;

  /**
   * Constructor for creating an instance of SplunkAPIClient.
   * @param config
   * @param fetchAPI
   * @param log
   */
  constructor(config: object, fetchAPI, log?: Console);

  /**
   * Asynchronous method to log in to Splunk.
   * @param username
   * @param password
   */
  login(username?: string, password?: string):
    Promise<SplunkLoginResult>;

  /**
   * Execute an ad-hoc Splunk oneshot search.
   * Throws on error.
   */
  oneshotSearch(searchString: string): Promise<SplunkOneshotResponse>;

  /**
   * Asynchronous method to check for Not Found errors
   * which return a status of 200 and are an opportunity
   * to reduce unnecessary content requests.
   * @param minutes
   * @param username
   * @param password
   */
  getNotFounds(minutes?: number, username?: string, password?: string):
    Promise<
      | { results: Array<Record<string, unknown>> }
      | { error: unknown }
    >;
}
