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

import { hasText, isValidUrl, isArray } from '@adobe/spacecat-shared-utils';
import { context as h2, h1 } from '@adobe/fetch';

import { ENDPOINTS } from './endpoints.js';
import {
  parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, todayISO, buildFilter,
  extractBrand,
} from './utils.js';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();

const DEFAULT_DATABASE = 'us';

const STUB_RESPONSE = { result: {}, fullAuditRef: '' };

export default class SeoClient {
  static createFrom(context) {
    const { SEO_API_BASE_URL: apiBaseUrl, SEO_API_KEY: apiKey } = context.env;
    return new SeoClient({ apiBaseUrl, apiKey }, fetch, context.log);
  }

  constructor(config, fetchAPI, log = console) {
    const { apiKey, apiBaseUrl } = config;

    if (!isValidUrl(apiBaseUrl)) {
      throw new Error(`Invalid SEO API Base URL: ${apiBaseUrl}`);
    }

    if (typeof fetchAPI !== 'function') {
      throw Error('"fetchAPI" must be a function');
    }

    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
    this.fetchAPI = fetchAPI;
    this.log = log;
  }

  async sendRequest(queryParams = {}, apiPath = '') {
    const params = { ...queryParams, key: this.apiKey };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const baseUrl = this.apiBaseUrl.replace(/\/$/, '');
    const pathSegment = apiPath ? `/${apiPath}` : '';
    const requestUrl = `${baseUrl}${pathSegment}?${queryString}`;

    // Mask the API key in the audit ref URL
    const fullAuditRef = requestUrl.replace(
      `key=${encodeURIComponent(this.apiKey)}`,
      'key=REDACTED',
    );

    this.log.debug(`SEO API request: ${fullAuditRef}`);
    const response = await this.fetchAPI(requestUrl, { method: 'GET' });
    const body = await response.text();

    // SEO API returns HTTP 200 even on errors, with "ERROR XX :: message" body
    if (body.startsWith('ERROR')) {
      const errorMessage = `SEO API request failed: ${body}`;
      this.log.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!response.ok) {
      const errorMessage = `SEO API request failed with status: ${response.status} - ${body}`;
      this.log.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.log.info(`SEO API response for type=${queryParams.type || 'unknown'}`);

    return { body, fullAuditRef };
  }

  async getTopPages(url, limit = 200) {
    const ep = ENDPOINTS.topPages;
    const epKw = ENDPOINTS.topPagesKeywords;
    const effectiveLimit = getLimit(limit, 2000);

    const commonParams = {
      domain: url,
      database: DEFAULT_DATABASE,
    };

    // Call 1: Get pages with traffic
    const { body: pagesBody, fullAuditRef } = await this.sendRequest({
      type: ep.type,
      ...commonParams,
      display_limit: effectiveLimit,
      export_columns: ep.columns,
      display_filter: buildFilter([{
        sign: '+', field: 'Tg', op: 'Gt', value: '0',
      }]),
      ...ep.defaultParams,
    }, ep.path);
    const pageRows = parseCsvResponse(pagesBody);

    // Call 2: Get top keyword per URL
    const { body: kwBody } = await this.sendRequest({
      type: epKw.type,
      ...commonParams,
      display_limit: effectiveLimit * 3,
      export_columns: epKw.columns,
      ...epKw.defaultParams,
    }, epKw.path);
    const kwRows = parseCsvResponse(kwBody);

    // Build keyword lookup: URL → top keyword (first occurrence = highest traffic)
    const keywordMap = new Map();
    for (const row of kwRows) {
      if (!keywordMap.has(row.Ur)) {
        keywordMap.set(row.Ur, row.Ph);
      }
    }

    const pages = pageRows.map((row) => ({
      url: row.Ur,
      sum_traffic: coerceValue(row.Tg, 'int'),
      top_keyword: keywordMap.get(row.Ur) ?? null,
    }));

    return {
      result: { pages },
      fullAuditRef,
    };
  }

  async getPaidPages(
    url,
    date = todayISO(),
    limit = 200,
    // eslint-disable-next-line no-unused-vars
    mode = 'prefix',
  ) {
    const ep = ENDPOINTS.paidPages;
    const effectiveLimit = getLimit(limit, 1000);

    const { body, fullAuditRef } = await this.sendRequest({
      type: ep.type,
      domain: url,
      database: DEFAULT_DATABASE,
      display_date: toApiDate(date),
      display_limit: effectiveLimit * 10,
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path);
    const rows = parseCsvResponse(body);

    // Group keywords by URL
    const pageMap = new Map();
    for (const row of rows) {
      const pageUrl = row.Ur;
      if (!pageMap.has(pageUrl)) {
        pageMap.set(pageUrl, { url: pageUrl, keywords: [], totalTraffic: 0 });
      }
      const page = pageMap.get(pageUrl);
      const traffic = coerceValue(row.Tg, 'int') || 0;
      page.totalTraffic += traffic;
      page.keywords.push({ ...row, kwTraffic: traffic });
    }

    // Transform to page-level aggregation, sorted by traffic desc
    const pages = [...pageMap.values()]
      .sort((a, b) => b.totalTraffic - a.totalTraffic)
      .slice(0, effectiveLimit)
      .map((page) => {
        const topKw = page.keywords.reduce(
          (best, kw) => (kw.kwTraffic > best.kwTraffic ? kw : best),
          page.keywords[0],
        );
        return {
          url: page.url,
          top_keyword: topKw.Ph,
          top_keyword_best_position_title: topKw.Tt || null,
          top_keyword_country: DEFAULT_DATABASE.toUpperCase(),
          top_keyword_volume: coerceValue(topKw.Nq, 'int'),
          sum_traffic: page.totalTraffic,
          value: page.keywords.reduce(
            (sum, kw) => sum + Math.round(
              (kw.kwTraffic || 0) * (coerceValue(kw.Cp, 'float') || 0) * 100,
            ),
            0,
          ),
        };
      });

    return {
      result: { pages },
      fullAuditRef,
    };
  }

  async getMetrics(url, date = todayISO()) {
    const ep = ENDPOINTS.metrics;

    const { body, fullAuditRef } = await this.sendRequest({
      type: ep.type,
      domain: url,
      database: DEFAULT_DATABASE,
      display_date: toApiDate(date),
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path);
    const rows = parseCsvResponse(body);
    const row = rows[0] || {};

    return {
      result: {
        metrics: {
          org_keywords: coerceValue(row.Or, 'int'),
          paid_keywords: coerceValue(row.Ad, 'int'),
          org_keywords_1_3: coerceValue(row.X0, 'int'),
          org_traffic: coerceValue(row.Ot, 'int'),
          org_cost: (coerceValue(row.Oc, 'int') || 0) * 100,
          paid_traffic: coerceValue(row.At, 'int'),
          paid_cost: (coerceValue(row.Ac, 'int') || 0) * 100,
          paid_pages: null,
        },
      },
      fullAuditRef,
    };
  }

  async getOrganicTraffic(url, startDate, endDate) {
    const ep = ENDPOINTS.organicTraffic;

    const { body, fullAuditRef } = await this.sendRequest({
      type: ep.type,
      domain: url,
      database: DEFAULT_DATABASE,
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path);
    const rows = parseCsvResponse(body);

    // Convert API dates (YYYYMMDD) to ISO (YYYY-MM-DD) and filter to requested range
    const filtered = rows
      .map((row) => ({ ...row, isoDate: fromApiDate(row.Dt) }))
      .filter((row) => row.isoDate >= startDate && row.isoDate <= endDate);

    return {
      result: {
        metrics: filtered.map((row) => ({
          date: `${row.isoDate}T00:00:00Z`,
          org_traffic: coerceValue(row.Ot, 'int'),
          paid_traffic: coerceValue(row.At, 'int'),
          org_cost: (coerceValue(row.Oc, 'int') || 0) * 100,
          paid_cost: (coerceValue(row.Ac, 'int') || 0) * 100,
        })),
      },
      fullAuditRef,
    };
  }

  async getOrganicKeywords(url, {
    country = DEFAULT_DATABASE,
    keywordFilter = [],
    limit = 10,
    mode = 'prefix',
    excludeBranded = false,
  } = {}) {
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (!hasText(country)) {
      throw new Error(`Invalid country: ${country}`);
    }
    if (!isArray(keywordFilter)) {
      throw new Error(`Invalid keyword filter: ${keywordFilter}`);
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`Invalid limit: ${limit}`);
    }
    if (!['prefix', 'exact'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    const ep = ENDPOINTS.organicKeywords;

    // Over-fetch when excluding branded (client-side filter)
    const fetchLimit = excludeBranded
      ? getLimit(limit * 3, 300)
      : getLimit(limit, 100);

    const params = {
      type: ep.type,
      domain: url,
      database: country,
      display_limit: fetchLimit,
      export_columns: ep.columns,
      ...ep.defaultParams,
    };

    // Build keyword display_filter if keyword filters provided
    if (keywordFilter.length > 0) {
      params.display_filter = buildFilter(
        keywordFilter.map((kw) => ({
          sign: '+', field: 'Ph', op: 'Co', value: kw,
        })),
      );
    }

    this.log.debug(`Getting organic keywords for ${url} with country ${country}, mode ${mode}, limit ${limit}, excludeBranded ${excludeBranded}`);

    const { body, fullAuditRef } = await this.sendRequest(params, ep.path);
    const rows = parseCsvResponse(body);

    // Client-side brand detection since API doesn't support Br column
    const brand = extractBrand(url);

    let keywords = rows.map((row) => {
      const intents = row.In ? row.In.split(',').map(Number) : [];
      return {
        keyword: row.Ph,
        keyword_country: country,
        language: null,
        sum_traffic: coerceValue(row.Tg, 'int'),
        volume: coerceValue(row.Nq, 'int'),
        best_position: coerceValue(row.Po, 'int'),
        best_position_url: row.Ur,
        cpc: Math.round((coerceValue(row.Cp, 'float') || 0) * 100),
        last_update: row.Ts
          ? new Date(parseInt(row.Ts, 10) * 1000).toISOString()
          : null,
        is_branded: brand.length > 1 && (row.Ph || '').toLowerCase().includes(brand),
        is_navigational: intents.includes(2),
        is_informational: intents.includes(1),
        is_commercial: intents.includes(0),
        is_transactional: intents.includes(3),
        serp_features: row.Fp || null,
      };
    });

    if (excludeBranded) {
      keywords = keywords.filter((kw) => !kw.is_branded);
    }
    keywords = keywords.slice(0, limit);

    return {
      result: { keywords },
      fullAuditRef,
    };
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getBrokenBacklinks(url, limit = 50) {
    return STUB_RESPONSE;
  }

  // --- Out of scope methods (stubs) ---

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getBacklinks(url, limit = 200) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getMetricsByCountry(url, date = todayISO()) {
    return STUB_RESPONSE;
  }
}
