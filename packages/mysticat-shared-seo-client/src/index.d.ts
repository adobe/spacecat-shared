/*
 * Copyright 2026 Adobe. All rights reserved.
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

export interface SeoAPIOptions {
    type: string;
    domain?: string;
    target?: string;
    target_type?: string;
    database?: string;
    display_date?: string;
    display_limit?: number;
    display_sort?: string;
    display_filter?: string;
    export_columns?: string;
    export_escape?: number;
    key?: string;
}

export default class SeoClient {
  /**
   * Static factory method to create an instance of SeoClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of SeoClient.
   */
  static createFrom(context: UniversalContext): SeoClient;

  /**
   * Constructor for creating an instance of SeoClient.
   * @param config
   * @param fetchAPI
   * @param log
   */
  constructor(config: object, fetchAPI: Function, log?: Console);

  /**
   * Asynchronous method to send a request to the SEO API.
   * Backward-compatible with the old AhrefsAPIClient.sendRequest(endpoint, queryParams) signature.
   * @param endpoint - API endpoint path
   * @param queryParams - Query parameters
   */
  sendRequest(endpoint: string, queryParams?: SeoAPIOptions):
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
   * Asynchronous method to get organic traffic history.
   * @param url - The target URL
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   */
  getOrganicTraffic(url: string, startDate: string, endDate: string):
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
      mode?: 'exact' | 'prefix',
      excludeBranded?: boolean,
    }):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
   * Asynchronous method to get paid pages for a URL.
   * @param url - The target URL
   * @param date - Optional date in YYYY-MM-DD format, defaults to today
   * @param limit - Maximum number of results to return (max: 1000)
   * @param mode - Search mode
   */
  getPaidPages(url: string, date?: string, limit?: number,
    mode?: 'exact' | 'prefix' | 'domain' | 'subdomains'):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
   * Asynchronous method to get metrics for a URL.
   * @param url - The target URL
   * @param date - Optional date in YYYY-MM-DD format, defaults to today
   */
  getMetrics(url: string, date?: string):
      Promise<{ result: object, fullAuditRef: string }>;

  /**
   * Asynchronous method to get metrics by country for a URL.
   * @param url - The target URL
   * @param date - Optional date in YYYY-MM-DD format, defaults to today
   */
  getMetricsByCountry(url: string, date?: string):
      Promise<{ result: object, fullAuditRef: string }>;
}

export function parseCsvResponse(text: string): object[];
export function coerceValue(value: string, type: 'int' | 'float' | 'string' | 'bool'): any;
export function getLimit(limit: number, upperLimit: number): number;
export function toApiDate(date: string): string;
export function todayISO(): string;
export function buildFilter(filters: Array<{sign: string, field: string, op: string, value: string}>): string;
export function buildQueryParams(defaults: object, overrides: object): object;

export const ORGANIC_KEYWORDS_FIELDS: readonly string[];
export const METRICS_BY_COUNTRY_FILTER_FIELDS: readonly string[];
export const ENDPOINTS: Record<string, { type: string, columns: string, defaultParams: object }>;
export function fetch(...args: any[]): Promise<Response>;
