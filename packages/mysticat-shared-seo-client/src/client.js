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
  parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, buildFilter,
  extractBrand, INTENT_CODES,
} from './utils.js';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();

const DEFAULT_DATABASE = 'us';
const MAX_ERROR_BODY_LENGTH = 500;
const MAX_PAID_KEYWORDS_FETCH = 10000;
const RATE_LIMIT_BASE_DELAY_MS = 1000;
const MAX_RETRIES = 4;

const BROKEN_LINKS_URL = 'https://api.semrush.com/apis/v4/backlinks-external/v0/broken-links';
const SEMRUSH_TOKEN_URL = 'https://api.semrush.com/apis/v4-raw/auth/v0/oauth2/access_token';
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry
const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000; // Semrush tokens live ~5 min
const semrushTokenCache = new Map(); // key: clientId → { token, expiresAt }
const LOW_VALUE_HOSTS = [
  'search.yahoo.com', 'bing.com', 'search.brave.com', 'duckduckgo.com',
  'yandex.com', 'yandex.ru', 'baidu.com', 'web.archive.org',
  'webcache.googleusercontent.com', 'cache.google.com',
  'translate.google.com', 'translate.googleusercontent.com',
  'sites.google.com',
];

/**
 * Major SEO provider databases by search volume. Used as the default fan-out
 * set for getTopPages to aggregate traffic across top global markets.
 */
export const BIG_MARKETS = ['us', 'in', 'jp', 'br', 'uk', 'de', 'fr', 'ph', 'ca', 'it', 'au', 'mx', 'id', 'es', 'pk', 'nl', 'bd', 'pl', 'my', 'kr', 'th', 'co', 'ru', 'tr', 'ar', 'za', 'pe', 'vn', 'tw', 'ae'];

/**
 * Returns the list of databases to query: BIG_MARKETS + site region if not already present.
 * @param {string} [region] - ISO 3166-1 alpha-2 region code (e.g. 'CZ')
 * @returns {string[]}
 */
export function getDatabases(region) {
  const databases = [...BIG_MARKETS];
  if (region) {
    const db = region.toLowerCase();
    if (!databases.includes(db)) {
      databases.push(db);
    }
  }
  return databases;
}

const FANOUT_BATCH_SIZE = 10;

const STUB_RESPONSE = { result: {}, fullAuditRef: '' };

export default class SeoClient {
  static delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  static createFrom(context) {
    const {
      SEO_API_BASE_URL: apiBaseUrl,
      SEO_API_KEY: apiKey,
      SEMRUSH_CLIENT_ID: semrushClientId,
      SEMRUSH_CLIENT_SECRET: semrushClientSecret,
      SEMRUSH_BROKEN_LINKS_SCOPE: semrushScope,
    } = context.env;
    return new SeoClient({
      apiBaseUrl, apiKey, semrushClientId, semrushClientSecret, semrushScope,
    }, fetch, context.log);
  }

  constructor(config, fetchAPI, log = console) {
    const { apiKey, apiBaseUrl } = config;

    if (!isValidUrl(apiBaseUrl)) {
      throw new Error(`Invalid SEO API Base URL: ${apiBaseUrl}`);
    }

    if (!hasText(apiKey)) {
      throw new Error('Missing SEO API key');
    }

    if (typeof fetchAPI !== 'function') {
      throw Error('"fetchAPI" must be a function');
    }

    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
    this.fetchAPI = fetchAPI;
    this.log = log;
    this.semrushClientId = config.semrushClientId || null;
    this.semrushClientSecret = config.semrushClientSecret || null;
    this.semrushScope = config.semrushScope || null;
  }

  /**
   * @private
   * Fans out an async operation across items in batches, collects fulfilled
   * results, and logs rejected ones. Each call to `fn(item)` already has
   * per-request retry/backoff via sendRawRequest; this layer adds batching to
   * respect rate limits and consistent error reporting for items that fail
   * after all retries are exhausted.
   *
   * @param {string[]} items - Items to process (database codes, URLs, etc.)
   * @param {function(string): Promise<T>} fn - Async operation per item
   * @param {string} operation - Name for logging (e.g. 'getTopPages')
   * @returns {Promise<Array<{key: string, value: T}>>} Fulfilled results
   * @template T
   */
  async fanOut(items, fn, operation) {
    const fulfilled = [];

    for (let i = 0; i < items.length; i += FANOUT_BATCH_SIZE) {
      const batch = items.slice(i, i + FANOUT_BATCH_SIZE);
      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.allSettled(batch.map((item) => fn(item)));

      for (let j = 0; j < results.length; j += 1) {
        const key = batch[j];
        const result = results[j];
        if (result.status === 'fulfilled') {
          fulfilled.push({ key, value: result.value });
        } else {
          /* c8 ignore next */
          this.log.warn(`${operation}: ${key} failed — ${result.reason?.message || result.reason}`);
        }
      }
    }

    return fulfilled;
  }

  /**
   * Internal method that executes the HTTP request and returns the raw CSV body.
   * Used by all endpoint methods for CSV parsing.
   * @param {object} queryParams - Query parameters including type, domain, etc.
   * @param {string} [apiPath=''] - Optional API path segment (e.g., 'analytics/v1/')
   * @returns {Promise<{body: string, fullAuditRef: string}>}
   */
  async sendRawRequest(queryParams = {}, apiPath = '') {
    const params = { ...queryParams, key: this.apiKey };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const baseUrl = this.apiBaseUrl.replace(/\/$/, '');
    const pathSegment = apiPath ? `/${apiPath.replace(/^\//, '')}` : '';
    const requestUrl = `${baseUrl}${pathSegment}?${queryString}`;

    // Mask the API key in the audit ref URL
    const fullAuditRef = requestUrl.replace(
      `key=${encodeURIComponent(this.apiKey)}`,
      'key=REDACTED',
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      this.log.debug(`SEO API request: ${fullAuditRef}${attempt > 0 ? ` (retry ${attempt})` : ''}`);
      // eslint-disable-next-line no-await-in-loop
      const response = await this.fetchAPI(requestUrl, { method: 'GET' });
      // eslint-disable-next-line no-await-in-loop
      const body = await response.text();

      // SEO API returns HTTP 200 with "ERROR XX :: message" body on errors
      if (body.startsWith('ERROR')) {
        const isRateLimit = body.includes('LIMIT EXCEEDED');
        const isNoData = body.includes('NOTHING FOUND');
        if (isRateLimit && attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s, 8s + random jitter 0-500ms
          const retryDelay = (RATE_LIMIT_BASE_DELAY_MS * (2 ** attempt))
            + Math.floor(Math.random() * 500);
          this.log.warn(`SEO API rate limited, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          // eslint-disable-next-line no-await-in-loop
          await SeoClient.delay(retryDelay);
          // eslint-disable-next-line no-continue
          continue;
        }
        if (isNoData) {
          this.log.info(`SEO API returned no data for domain=${queryParams.domain || queryParams.target || '-'} type=${queryParams.type || 'unknown'}`);
          return { body: '', fullAuditRef };
        }
        const prefix = isRateLimit && attempt >= MAX_RETRIES
          ? `SEO API request failed after ${MAX_RETRIES} retries: `
          : 'SEO API request failed: ';
        const errorMessage = `${prefix}${body.slice(0, MAX_ERROR_BODY_LENGTH)}`;
        this.log.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (!response.ok) {
        const errorMessage = `SEO API request failed with status: ${response.status} - ${body.slice(0, MAX_ERROR_BODY_LENGTH)}`;
        this.log.error(errorMessage);
        throw new Error(errorMessage);
      }

      const rowCount = body.split('\n').length - 1;
      this.log.info(`SEO API call: type=${queryParams.type || 'unknown'} domain=${queryParams.domain || queryParams.target || '-'} rows=${rowCount} path=${apiPath || '/'}`);

      return { body, fullAuditRef };
    }
    /* c8 ignore next */
    throw new Error('SEO API request failed: unexpected retry loop exit');
  }

  /**
   * Public method matching the old AhrefsAPIClient.sendRequest(endpoint, queryParams) signature.
   * Sends a request and returns a parsed result object.
   * @param {string} endpoint - API endpoint path (e.g., '/site-explorer/top-pages')
   * @param {object} [queryParams={}] - Query parameters
   * @returns {Promise<{result: object, fullAuditRef: string}>}
   */
  async sendRequest(endpoint, queryParams = {}) {
    const { body, fullAuditRef } = await this.sendRawRequest(queryParams, endpoint);
    const rows = parseCsvResponse(body);
    const result = rows.length === 1 ? rows[0] : rows;

    return { result, fullAuditRef };
  }

  async getTopPages(url, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new Error('Second argument must be an options object, not a positional value');
    }
    const { limit = 200, region } = opts;
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Ensure url has protocol for the Bw filter and extract hostname for the API.
    // Input is a prefix URL, either full (https://www.example.com) or protocol-stripped
    // (www.example.com, example.com/us).
    const prefixUrl = (url.includes('://') ? url : `https://${url}`).replace(/\/+$/, '');
    let domain;
    try {
      domain = new URL(prefixUrl).hostname;
    } catch {
      this.log.warn(`[SEO] Could not parse URL "${url}", using raw value as domain`);
      domain = url;
    }

    const isWww = domain.startsWith('www.');
    const ep = ENDPOINTS.topPages;
    const epKw = ENDPOINTS.topPagesKeywords;

    // For non-www prefixes, the Bw filter is unreliable (matches subdomains),
    // so we over-fetch and filter client-side. Note: at limit >= 1000 the 2000
    // cap leaves no over-fetch headroom.
    const requestLimit = !isWww
      ? getLimit(limit * 2, 2000)
      : getLimit(limit, 2000);
    const databases = getDatabases(region);

    // Build display_filter: traffic > 0, plus Bw prefix filter
    const filters = [
      {
        sign: '+', field: 'Tg', op: 'Gt', value: '0',
      },
      {
        sign: '+', field: 'Ur', op: 'Bw', value: prefixUrl,
      },
    ];

    const dbResults = await this.fanOut(databases, async (db) => {
      const commonParams = { domain, database: db };
      const [{ body: pagesBody, fullAuditRef: ref }, { body: kwBody }] = await Promise.all([
        this.sendRawRequest({
          type: ep.type,
          ...commonParams,
          display_limit: requestLimit,
          export_columns: ep.columns,
          display_filter: buildFilter(filters),
          ...ep.defaultParams,
        }, ep.path),
        this.sendRawRequest({
          type: epKw.type,
          ...commonParams,
          display_limit: requestLimit * 3,
          export_columns: epKw.columns,
          ...epKw.defaultParams,
        }, epKw.path),
      ]);
      return {
        pageRows: parseCsvResponse(pagesBody),
        kwRows: parseCsvResponse(kwBody),
        fullAuditRef: ref,
      };
    }, 'getTopPages');

    // Merge pages: sum traffic across databases, keep first keyword per URL
    const pageMap = new Map();
    const keywordMap = new Map();
    let fullAuditRef = '';

    for (const { value } of dbResults) {
      if (!fullAuditRef) {
        fullAuditRef = value.fullAuditRef;
      }

      for (const row of value.kwRows) {
        if (!keywordMap.has(row.Ur)) {
          keywordMap.set(row.Ur, row.Ph);
        }
      }

      for (const row of value.pageRows) {
        const traffic = coerceValue(row.Tg, 'int') || 0;
        const existing = pageMap.get(row.Ur);
        if (existing) {
          existing.sum_traffic += traffic;
        } else {
          pageMap.set(row.Ur, { url: row.Ur, sum_traffic: traffic });
        }
      }
    }

    let pages = [...pageMap.values()]
      .map((page) => ({
        ...page,
        top_keyword: keywordMap.get(page.url) ?? null,
      }))
      .sort((a, b) => b.sum_traffic - a.sum_traffic);

    // For non-www prefixes, apply client-side filtering since Bw is unreliable
    if (!isWww) {
      const filteredPages = pages.filter(
        (page) => page.url === prefixUrl
          || page.url.startsWith(`${prefixUrl}/`),
      );

      if (filteredPages.length < limit && pages.length >= requestLimit) {
        this.log.warn(`[SEO] Could not meet ${limit} top pages for ${prefixUrl} after requesting ${requestLimit} (got ${filteredPages.length} matching)`);
      } else if (filteredPages.length < limit) {
        this.log.debug(`[SEO] Provider has only ${filteredPages.length} pages matching prefix ${prefixUrl}`);
      }

      pages = filteredPages;
    }

    pages = pages.slice(0, limit);

    return {
      result: { pages },
      fullAuditRef,
    };
  }

  /**
   * Fetch paid (PPC) pages and their keyword data from Semrush.
   *
   * Per-keyword CPC is returned as float dollars (e.g., 3.95) with null for unknown.
   * This deliberately differs from getOrganicKeywords() which returns CPC as integer
   * cents (e.g., 395) with 0 for unknown. The float-dollars convention was chosen for
   * the keywords[] array because downstream consumers (import-worker, Mystique) expect
   * dollars and the per-keyword CPC should not go through the cents round-trip used by
   * the aggregate `value` field.
   *
   * @param {string} url - Domain to query
   * @param {Object} [opts] - Options
   * @param {string} [opts.date] - Report date
   * @param {number} [opts.limit=200] - Max pages to return
   * @param {string} [opts.region] - Limit to specific region
   * @returns {Promise<{result: {pages: Array}, fullAuditRef: string}>}
   */
  async getPaidPages(url, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new Error('Second argument must be an options object, not a positional value');
    }
    const { date, limit = 200, region } = opts;
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const ep = ENDPOINTS.paidPages;
    const effectiveLimit = getLimit(limit, 1000);
    const databases = getDatabases(region);

    // Over-fetch keywords to aggregate into pages. A domain typically has more
    // keywords than pages, so we fetch a multiple of the requested limit.
    // Capped at MAX_PAID_KEYWORDS_FETCH to bound cost.
    const fetchLimit = Math.min(effectiveLimit * 10, MAX_PAID_KEYWORDS_FETCH);

    const dbResults = await this.fanOut(databases, (db) => {
      const params = {
        type: ep.type,
        domain: url,
        database: db,
        display_limit: fetchLimit,
        export_columns: ep.columns,
        ...ep.defaultParams,
      };
      // Omitting display_date returns the provider's latest snapshot at live pricing
      // (5x cheaper). The returned data may differ slightly from a pinned monthly
      // snapshot, which is acceptable for our use case.
      if (date) {
        params.display_date = toApiDate(date);
      }
      return this.sendRawRequest(params, ep.path);
    }, 'getPaidPages');

    // Group keywords by URL across all databases
    const pageMap = new Map();
    let fullAuditRef = '';

    for (const { key: db, value } of dbResults) {
      if (!fullAuditRef) {
        fullAuditRef = value.fullAuditRef;
      }

      const rows = parseCsvResponse(value.body);
      for (const row of rows) {
        const pageUrl = row.Ur;
        if (!pageMap.has(pageUrl)) {
          pageMap.set(pageUrl, { url: pageUrl, keywords: [], totalTraffic: 0 });
        }
        const page = pageMap.get(pageUrl);
        const traffic = coerceValue(row.Tg, 'int') || 0;
        page.totalTraffic += traffic;
        page.keywords.push({ ...row, kwTraffic: traffic, db });
      }
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
          top_keyword_country: topKw.db.toUpperCase(),
          top_keyword_volume: coerceValue(topKw.Nq, 'int'),
          sum_traffic: page.totalTraffic,
          value: page.keywords.reduce(
            (sum, kw) => sum + Math.round(
              (kw.kwTraffic || 0) * (coerceValue(kw.Cp, 'float') || 0) * 100,
            ),
            0,
          ),
          keywords: page.keywords.map((kw) => ({
            keyword: kw.Ph,
            traffic: kw.kwTraffic,
            cpc: coerceValue(kw.Cp, 'float') ?? null,
            serp_title: kw.Tt || null,
            serp_description: kw.Ds || null,
            visible_url: kw.Vu || null,
            position: coerceValue(kw.Po, 'int') ?? null,
            volume: coerceValue(kw.Nq, 'int') ?? null,
            country: kw.db.toUpperCase(),
          })),
        };
      });

    return {
      result: { pages },
      fullAuditRef,
    };
  }

  async getMetrics(url, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new Error('Second argument must be an options object, not a positional value');
    }
    const { date, region } = opts;
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const ep = ENDPOINTS.metrics;
    const databases = getDatabases(region);

    const dbResults = await this.fanOut(databases, (db) => {
      const params = {
        type: ep.type,
        domain: url,
        database: db,
        export_columns: ep.columns,
        ...ep.defaultParams,
      };
      // Omitting display_date returns the provider's latest snapshot at live pricing
      // (5x cheaper). The returned data may differ slightly from a pinned monthly
      // snapshot, which is acceptable for our use case.
      if (date) {
        params.display_date = toApiDate(date);
      }
      return this.sendRawRequest(params, ep.path);
    }, 'getMetrics');

    const metrics = {
      org_keywords: 0,
      paid_keywords: 0,
      org_keywords_1_3: 0,
      org_traffic: 0,
      org_cost: 0,
      paid_traffic: 0,
      paid_cost: 0,
      paid_pages: null,
    };
    let fullAuditRef = '';
    let hasData = false;

    for (const { value } of dbResults) {
      if (!fullAuditRef) {
        fullAuditRef = value.fullAuditRef;
      }

      const rows = parseCsvResponse(value.body);
      const row = rows[0];
      if (row) {
        hasData = true;
        metrics.org_keywords += coerceValue(row.Or, 'int') || 0;
        metrics.paid_keywords += coerceValue(row.Ad, 'int') || 0;
        metrics.org_keywords_1_3 += coerceValue(row.X0, 'int') || 0;
        metrics.org_traffic += coerceValue(row.Ot, 'int') || 0;
        metrics.org_cost += Math.round((coerceValue(row.Oc, 'float') || 0) * 100);
        metrics.paid_traffic += coerceValue(row.At, 'int') || 0;
        metrics.paid_cost += Math.round((coerceValue(row.Ac, 'float') || 0) * 100);
      }
    }

    if (!hasData) {
      metrics.org_keywords = null;
      metrics.paid_keywords = null;
      metrics.org_keywords_1_3 = null;
      metrics.org_traffic = null;
      metrics.org_cost = 0;
      metrics.paid_traffic = null;
      metrics.paid_cost = 0;
    }

    return {
      result: { metrics },
      fullAuditRef,
    };
  }

  /**
   * Retrieves historical organic traffic metrics for a URL within a date range.
   * Note: The SEO data provider returns monthly data points only (no weekly option).
   * The full history is fetched and filtered client-side because the provider's
   * history endpoint does not support date range parameters.
   * @param {string} url - The target domain
   * @param {object} options
   * @param {string} options.startDate - Start date in YYYY-MM-DD format
   * @param {string} options.endDate - End date in YYYY-MM-DD format
   * @param {string} [options.region] - ISO 3166-1 alpha-2 region code
   * @returns {Promise<{result: {metrics: Array}, fullAuditRef: string}>}
   */
  async getOrganicTraffic(url, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new Error('Second argument must be an options object, not a positional value');
    }
    const { startDate, endDate, region } = opts;
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (!hasText(startDate) || !hasText(endDate)) {
      throw new Error('startDate and endDate are required');
    }

    const ep = ENDPOINTS.organicTraffic;
    const databases = getDatabases(region);

    const dbResults = await this.fanOut(databases, (db) => this.sendRawRequest({
      type: ep.type,
      domain: url,
      database: db,
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path), 'getOrganicTraffic');

    // Group by date across all databases, sum numeric fields
    const dateMap = new Map();
    let fullAuditRef = '';

    for (const { value } of dbResults) {
      if (!fullAuditRef) {
        fullAuditRef = value.fullAuditRef;
      }

      const rows = parseCsvResponse(value.body);
      for (const row of rows) {
        const isoDate = fromApiDate(row.Dt);
        if (!isoDate || isoDate < startDate || isoDate > endDate) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const existing = dateMap.get(isoDate);
        if (existing) {
          existing.org_traffic += coerceValue(row.Ot, 'int') || 0;
          existing.paid_traffic += coerceValue(row.At, 'int') || 0;
          existing.org_cost += Math.round((coerceValue(row.Oc, 'float') || 0) * 100);
          /* c8 ignore next */
          existing.paid_cost += Math.round((coerceValue(row.Ac, 'float') || 0) * 100);
        } else {
          /* c8 ignore next 6 - || 0 null-coercion branches */
          dateMap.set(isoDate, {
            date: `${isoDate}T00:00:00Z`,
            org_traffic: coerceValue(row.Ot, 'int') || 0,
            paid_traffic: coerceValue(row.At, 'int') || 0,
            org_cost: Math.round((coerceValue(row.Oc, 'float') || 0) * 100),
            paid_cost: Math.round((coerceValue(row.Ac, 'float') || 0) * 100),
          });
        }
      }
    }

    const metrics = [...dateMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      result: { metrics },
      fullAuditRef,
    };
  }

  async getOrganicKeywords(url, {
    country = DEFAULT_DATABASE,
    keywordFilter = [],
    limit = 10,
    // Accepted for contract compatibility but not supported by this provider,
    // which scopes by report type (domain/subdomain/subfolder/URL) instead.
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

    const { body, fullAuditRef } = await this.sendRawRequest(params, ep.path);
    const rows = parseCsvResponse(body);

    // Client-side brand detection since the SEO data provider
    // does not expose a branded keyword flag
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
        is_navigational: intents.includes(INTENT_CODES.NAVIGATIONAL),
        is_informational: intents.includes(INTENT_CODES.INFORMATIONAL),
        is_commercial: intents.includes(INTENT_CODES.COMMERCIAL),
        is_transactional: intents.includes(INTENT_CODES.TRANSACTIONAL),
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

  hasNewBrokenBacklinksEndpoint() {
    return !!(this.semrushClientId && this.semrushClientSecret && this.semrushScope);
  }

  async _getSemrushToken() {
    const cacheKey = this.semrushClientId;
    const now = Date.now();
    const cached = semrushTokenCache.get(cacheKey);
    if (cached && now < cached.expiresAt) {
      return cached.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.semrushClientId,
      client_secret: this.semrushClientSecret,
      scope: this.semrushScope,
    });
    const r = await this.fetchAPI(SEMRUSH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await r.json();
    if (!json.access_token) {
      throw new Error(`Semrush OAuth token request failed (HTTP ${r.status}): ${json.error || 'unknown'}`);
    }

    const ttlMs = json.expires_in
      ? Math.max((Number(json.expires_in) * 1000) - TOKEN_REFRESH_BUFFER_MS, 1000)
      : DEFAULT_TOKEN_TTL_MS - TOKEN_REFRESH_BUFFER_MS;
    semrushTokenCache.set(cacheKey, { token: json.access_token, expiresAt: now + ttlMs });

    return json.access_token;
  }

  static computePriorityScore(row) {
    const pageNorm = (row.page_score ?? 0) / 100;
    const domainNorm = (row.domain_score ?? 0) / 100;
    let recency = 0;
    if (row.first_seen_at) {
      const daysSince = (Date.now() - new Date(row.first_seen_at).getTime())
        / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) {
        recency = 1.0;
      } else if (daysSince <= 90) {
        recency = 0.75;
      } else if (daysSince <= 180) {
        recency = 0.5;
      } else if (daysSince <= 365) {
        recency = 0.25;
      } else {
        recency = 0.1;
      }
    }
    return Math.round(((0.50 * pageNorm) + (0.40 * domainNorm) + (0.10 * recency)) * 1000) / 1000;
  }

  async getBrokenBacklinksV2(url, limit = 50) {
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (!this.hasNewBrokenBacklinksEndpoint()) {
      throw new Error('Missing Semrush OAuth2 credentials (SEMRUSH_CLIENT_ID, SEMRUSH_CLIENT_SECRET, SEMRUSH_BROKEN_LINKS_SCOPE)');
    }

    const effectiveLimit = getLimit(limit, 100);
    const FETCH_LIMIT = 100;

    const token = await this._getSemrushToken();

    const notLike = LOW_VALUE_HOSTS.map((h) => `AND source_url NOT LIKE '%${h}%'`).join(' ');
    const filter = `is_nofollow=false AND is_lost=false AND response_code=200 AND is_image=false AND is_ugc=false AND domain_score>=50 ${notLike}`;

    const params = new URLSearchParams({
      url,
      scope: 'ROOT_DOMAIN',
      limit: String(FETCH_LIMIT),
      order_by: 'domain_score',
      direction: 'desc',
      filter,
      limit_by_field: 'target_url',
      limit_by_limit: '1',
    });

    const requestUrl = `${BROKEN_LINKS_URL}?${params}`;
    const fullAuditRef = requestUrl;

    const r = await this.fetchAPI(requestUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const bodyText = await r.text();
      throw new Error(`Semrush broken-links endpoint HTTP ${r.status}: ${bodyText.slice(0, 500)}`);
    }

    const { data } = await r.json();

    const scored = (data || [])
      .map((row) => ({ ...row, score: SeoClient.computePriorityScore(row) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, effectiveLimit);

    const total = scored.length;
    scored.forEach((row, i) => {
      const pct = (i + 1) / total;
      let relativeLabel;
      if (pct <= 0.20) {
        relativeLabel = 'High';
      } else if (pct <= 0.50) {
        relativeLabel = 'Medium';
      } else {
        relativeLabel = 'Low';
      }
      // eslint-disable-next-line no-param-reassign
      row.relativeLabel = relativeLabel;
    });

    const backlinks = scored.map((row) => ({
      title: row.source_title || null,
      url_from: row.source_url,
      url_to: row.target_url,
      traffic_domain: row.domain_score ?? null,
      page_score: row.page_score ?? null,
      domain_score: row.domain_score ?? null,
      first_seen_at: row.first_seen_at ?? null,
      last_seen_at: row.last_seen_at ?? null,
      source_domain: row.source_domain ?? null,
      anchor: row.anchor ?? null,
      is_nofollow: row.is_nofollow ?? null,
      is_lost: row.is_lost ?? null,
      response_code: row.response_code ?? null,
      priority_score: row.score,
      priority_label: row.relativeLabel,
    }));

    this.log.info(`SEO broken-links v2: url=${url} fetched=${(data || []).length} returned=${backlinks.length}`);

    return { result: { backlinks }, fullAuditRef };
  }

  /**
   * Retrieves broken backlinks for a domain — links pointing to pages that return 404.
   *
   * The SEO data provider does not offer a single broken-backlinks endpoint (unlike the
   * previous provider). This method uses a two-step approach:
   *
   * Step 1: Call `backlinks_pages` with a server-side 404 filter to discover which of
   * the domain's pages are broken, sorted by referring domain count (highest first).
   * This is a single API call.
   *
   * Step 2: For each broken page (up to `limit`), fetch the single highest-quality
   * backlink (by authority score) using `backlinks` with `display_limit=1`. These calls
   * are parallelized in batches of 10 to respect rate limits while minimizing latency.
   *
   * This approach maximizes broken page diversity — each result row represents a different
   * broken page on the domain, paired with its best referring link. This matches the
   * practical value of the old provider's single-call endpoint, where results typically
   * surfaced many unique broken target URLs.
   *
   * Note on `traffic_domain` field: The previous provider returned estimated monthly
   * organic traffic (0 to millions). This implementation maps it to the referring page's
   * authority score (0-100). Relative ranking is preserved but absolute values differ.
   *
   * @param {string} url - The target domain
   * @param {number} [limit=50] - Maximum results (default: 50, max: 100)
   * @returns {Promise<{result: {backlinks: Array}, fullAuditRef: string}>}
   */
  async getBrokenBacklinks(url, limit = 50) {
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const epPages = ENDPOINTS.brokenBacklinksPages;
    const epLinks = ENDPOINTS.brokenBacklinks;
    const effectiveLimit = getLimit(limit, 100);

    // Step 1: Find broken target pages — 404 and 410 in parallel (Semrush does not support OR
    // within a single display_filter, so we issue two requests and merge the results).
    const pageParams = (code) => ({
      type: epPages.type,
      target: url,
      target_type: 'domain',
      export_columns: epPages.columns,
      display_limit: effectiveLimit,
      display_filter: buildFilter([{
        sign: '+', field: 'responsecode', op: 'Eq', value: code,
      }]),
      ...epPages.defaultParams,
    });

    const [{ body: pages404Body, fullAuditRef }, { body: pages410Body }] = await Promise.all([
      this.sendRawRequest(pageParams('404'), epPages.path),
      this.sendRawRequest(pageParams('410'), epPages.path),
    ]);

    // Merge, deduplicate by source_url, re-sort by domains_num descending, cap at limit.
    const seenUrls = new Set();
    const brokenPages = [
      ...parseCsvResponse(pages404Body),
      ...parseCsvResponse(pages410Body),
    ]
      .filter((p) => {
        if (seenUrls.has(p.source_url)) {
          return false;
        }
        seenUrls.add(p.source_url);
        return true;
      })
      .sort((a, b) => Number(b.domains_num) - Number(a.domains_num))
      .slice(0, effectiveLimit);

    if (brokenPages.length === 0) {
      return { result: { backlinks: [] }, fullAuditRef };
    }

    // Step 2: For each broken page, fetch the top backlink by authority score with quality filters:
    //   - follow links only (nofollow links carry no SEO value)
    //   - text links only (more actionable than image/frame links)
    //   - exclude lostlinks (only active broken backlinks, not already-removed ones)
    const brokenUrls = brokenPages.map((p) => p.source_url);
    const linkResults = await this.fanOut(brokenUrls, (brokenUrl) => this.sendRawRequest({
      type: epLinks.type,
      target: brokenUrl,
      target_type: 'url',
      export_columns: epLinks.columns,
      display_limit: 1,
      display_filter: buildFilter([
        {
          sign: '+', field: 'type', op: '', value: 'follow',
        },
        {
          sign: '+', field: 'type', op: '', value: 'text',
        },
        {
          sign: '-', field: 'type', op: '', value: 'lostlink',
        },
      ]),
      ...epLinks.defaultParams,
    }, epLinks.path), 'getBrokenBacklinks');

    const allBacklinks = [];
    for (const { value } of linkResults) {
      const links = parseCsvResponse(value.body);
      if (links.length > 0) {
        allBacklinks.push(links[0]);
      }
    }

    const backlinks = allBacklinks.map((row) => ({
      title: row.source_title || null,
      url_from: row.source_url,
      url_to: row.target_url,
      traffic_domain: coerceValue(row.page_ascore, 'int'),
    }));

    return {
      result: { backlinks },
      fullAuditRef,
    };
  }

  // --- Out of scope methods (stubs) ---

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getBacklinks(url, limit = 200) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getMetricsByCountry(url, date) {
    return STUB_RESPONSE;
  }
}

export function clearSemrushTokenCache(clientId) {
  if (clientId) {
    semrushTokenCache.delete(clientId);
  } else {
    semrushTokenCache.clear();
  }
}
