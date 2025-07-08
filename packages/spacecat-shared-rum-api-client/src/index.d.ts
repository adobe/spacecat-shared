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
  /** The domain for which to fetch data. */
  domain: string;

  /**
   * The domain key. If not provided, the client will attempt to auto-fetch the domainkey
   * using the admin key (if configured). Fetched domainkeys are cached for subsequent calls.
   */
  domainkey?: string;

  /**
   * Interval in days.
   * @default 7
   */
  interval?: number;

  /**
   * Start Date
   */
  startDate?: string;

  /**
   * End Date
   */
  endDate?: string;

  /**
   * Granularity can be 'hourly' or 'daily'.
   * @default 'daily'
   */
  granularity?: 'hourly' | 'daily';

  groupedURLs?: Array<{
    name: string;
    pattern: string;
  }>;
}

export default class RUMAPIClient {
  /**
   * Static factory method to create an instance of RUMAPIClient.
   *
   * @param {UniversalContext} context - An object containing the HelixUniversal context.
   * The context must include an `env` property that can optionally include a `RUM_ADMIN_KEY`.
   * @returns An instance of RUMAPIClient.
   * @remarks This method creates a new instance from a HelixUniversal context and
   * caches it on the context.
   */
  static createFrom(context: UniversalContext): RUMAPIClient;

  /**
   * Constructor for creating an instance of RUMAPIClient.
   *
   * @param options Optional configuration. If you want the client to auto-fetch the domainkey,
   * provide the admin key as `rumAdminKey`.
   * @param log Optional logger, defaults to `console`.
   */
  constructor(options?: { rumAdminKey?: string }, log?: Console);

  /**
   * Asynchronous method to run a query against the RUM Bundler API.
   *
   * @param query - Name of the query to run.
   * @param opts - A object containing options for the query. Either provide a `domainkey`
   *               here or configure an admin key so that the client can fetch it automatically.
   * @returns A Promise resolving to an object with the query results.
   * @remarks See the README.md for the available queries.
   */
  query(query: string, opts: RUMAPIOptions): Promise<object>;

  /**
   * Asynchronous method to run multiple queries against the data fetched from the RUM Bundler API.
   *
   * This method makes a single call to the RUM Bundler API to fetch the raw data, then applies
   * all the requested queries to this raw data. The results are returned in an object where each
   * key corresponds to a query name and each value contains the result of that query.
   *
   * @param queries - An array of query names to execute.
   * @param opts - Optional object containing options for the queries.
   * @returns A Promise that resolves to an object where each key is the name
   *          of a query, and each value is the result of that query.
   */
  queryMulti(queries: string[], opts: RUMAPIOptions): Promise<object>;

  /**
   * Retrieves the domainkey for the given domain. If the domainkey was already fetched,
   * the cached value is returned.
   *
   * @param domain - The domain for which to retrieve the domainkey.
   * @returns A Promise resolving to the domainkey string.
   */
  retrieveDomainkey(domain: string): Promise<string>;
}
