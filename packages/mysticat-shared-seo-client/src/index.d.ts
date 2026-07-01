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
  static createFrom(context: UniversalContext): SeoClient;

  constructor(config: object, fetchAPI: Function, log?: Console);

  sendRequest(endpoint: string, queryParams?: SeoAPIOptions):
      Promise<{ result: object, fullAuditRef: string }>;

  sendRawRequest(queryParams?: SeoAPIOptions, apiPath?: string):
      Promise<{ body: string, fullAuditRef: string }>;

  getBrokenBacklinks(url: string, limit?: number):
      Promise<{ result: object, fullAuditRef: string }>;

  getTopPages(url: string, options?: {
    limit?: number,
    region?: string,
  }): Promise<{ result: object, fullAuditRef: string }>;

  getBacklinks(url: string, limit?: number):
      Promise<{ result: object, fullAuditRef: string }>;

  getOrganicTraffic(url: string, options?: {
    startDate?: string,
    endDate?: string,
    region?: string,
  }): Promise<{ result: object, fullAuditRef: string }>;

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

  getPaidPages(url: string, options?: {
    date?: string,
    limit?: number,
    region?: string,
  }): Promise<{ result: object, fullAuditRef: string }>;

  getMetrics(url: string, options?: {
    date?: string,
    region?: string,
  }): Promise<{ result: object, fullAuditRef: string }>;

  getMetricsByCountry(url: string, date?: string):
      Promise<{ result: object, fullAuditRef: string }>;
}

export function parseCsvResponse(text: string): object[];
export function coerceValue(value: string, type: 'int' | 'float' | 'string' | 'bool'): any;
export function getLimit(limit: number, upperLimit: number): number;
export function toApiDate(date: string): string;
export function fromApiDate(apiDate: string): string | null;
export function todayISO(): string;
export function lastMonthISO(): string;
export function getDatabases(region?: string): string[];
export const BIG_MARKETS: readonly string[];
export function buildFilter(filters: Array<{sign: string, field: string, op: string, value: string}>): string;
export function extractBrand(domain: string): string;
export function buildQueryParams(defaults: object, overrides: object): object;
/** @deprecated Use parseCsvResponse instead. */
export function parseResponse(response: any): any;

export const INTENT_CODES: {
  COMMERCIAL: 0,
  INFORMATIONAL: 1,
  NAVIGATIONAL: 2,
  TRANSACTIONAL: 3,
};
export const ORGANIC_KEYWORDS_FIELDS: readonly string[];
export const METRICS_BY_COUNTRY_FILTER_FIELDS: readonly string[];
export const ENDPOINTS: Record<string, { type: string, path: string, columns: string, defaultParams: object }>;
export function fetch(...args: any[]): Promise<Response>;

export interface GrpcClients {
  brandClient: unknown;
  topicClient: unknown;
  promptClient: unknown;
  sourceClient: unknown;
  competitorClient: unknown;
  crMetricsClient: unknown;
  crMetaClient: unknown;
  voSourcesClient: unknown;
  prRelationsClient: unknown;
}

export function getGrpcClients(env: Record<string, string | undefined>): GrpcClients;
export function resetGrpcClients(): void;
export function getAccessToken(env: Record<string, string | undefined>): Promise<string>;
export function createAuthInterceptor(env: Record<string, string | undefined>): (next: Function) => (req: any) => Promise<any>;
export function fetchTopicHashMap(topicClient: unknown, domain: string, options?: { limit?: number }): Promise<Map<string, string>>;
export function fetchGapPrompts(promptClient: unknown, topicHash: string, domain: string, options?: { limit?: number }): Promise<object[]>;
