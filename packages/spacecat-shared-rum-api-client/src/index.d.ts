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

export interface RUMAPIOptions {
    domain: string;
    domainkey: string;
    interval?: number;
    granularity?: 'hourly' | 'daily';
    groupedURLs?: Array<{
      name: string;
      pattern: string;
    }>;
}

export default class RUMAPIClient {
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
   */
  constructor();

  /**
   * Asynchronous method to run queries against RUM Bundler API.
   * @param {string} query - Name of the query to run.
   * @param {RUMAPIOptions} opts - A object containing options for query to run.
   * @returns A Promise resolving to an object with the query results.
   * @remarks See the README.md for the available queries.
   */
  query(query: string, opts?: RUMAPIOptions): Promise<object>;

  /**
   * Asynchronous method to run multiple queries against the data fetched from RUM Bundler API.
   *
   * This method makes a single call to the RUM Bundler API to fetch the raw data, then applies
   * all the requested queries to this raw data. The results are returned in an object where each
   * key corresponds to a query name and each value contains the result of that query.
   *
   * @param {string[]} queries - An array of query names to execute.
   * @param {RUMAPIOptions} [opts] - Optional object containing options for the queries.
   * @returns {Promise<object>} A Promise that resolves to an object where each key is the name
   * of a query, and each value is the result of that query.
   */
  queryMulti(queries: string[], opts?: RUMAPIOptions): Promise<object>;
}
