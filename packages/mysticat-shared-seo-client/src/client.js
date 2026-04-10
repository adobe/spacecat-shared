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
  parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, lastMonthISO, buildFilter,
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
    const { SEO_API_BASE_URL: apiBaseUrl, SEO_API_KEY: apiKey } = context.env;
    return new SeoClient({ apiBaseUrl, apiKey }, fetch, context.log);
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

    const ep = ENDPOINTS.topPages;
    const epKw = ENDPOINTS.topPagesKeywords;
    const effectiveLimit = getLimit(limit, 2000);
    const databases = getDatabases(region);

    const dbResults = await this.fanOut(databases, async (db) => {
      const commonParams = { domain: url, database: db };
      const [{ body: pagesBody, fullAuditRef }, { body: kwBody }] = await Promise.all([
        this.sendRawRequest({
          type: ep.type,
          ...commonParams,
          display_limit: effectiveLimit,
          export_columns: ep.columns,
          display_filter: buildFilter([{
            sign: '+', field: 'Tg', op: 'Gt', value: '0',
          }]),
          ...ep.defaultParams,
        }, ep.path),
        this.sendRawRequest({
          type: epKw.type,
          ...commonParams,
          display_limit: effectiveLimit * 3,
          export_columns: epKw.columns,
          ...epKw.defaultParams,
        }, epKw.path),
      ]);
      return {
        pageRows: parseCsvResponse(pagesBody),
        kwRows: parseCsvResponse(kwBody),
        fullAuditRef,
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

    const pages = [...pageMap.values()]
      .map((page) => ({
        ...page,
        top_keyword: keywordMap.get(page.url) ?? null,
      }))
      .sort((a, b) => b.sum_traffic - a.sum_traffic)
      .slice(0, effectiveLimit);

    return {
      result: { pages },
      fullAuditRef,
    };
  }

  async getPaidPages(url, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new Error('Second argument must be an options object, not a positional value');
    }
    const { date = lastMonthISO(), limit = 200, region } = opts;
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

    const dbResults = await this.fanOut(databases, (db) => this.sendRawRequest({
      type: ep.type,
      domain: url,
      database: db,
      display_date: toApiDate(date),
      display_limit: fetchLimit,
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path), 'getPaidPages');

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
    const { date = lastMonthISO(), region } = opts;
    if (!hasText(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const ep = ENDPOINTS.metrics;
    const databases = getDatabases(region);

    const dbResults = await this.fanOut(databases, (db) => this.sendRawRequest({
      type: ep.type,
      domain: url,
      database: db,
      display_date: toApiDate(date),
      export_columns: ep.columns,
      ...ep.defaultParams,
    }, ep.path), 'getMetrics');

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

    // Step 1: Find broken (404) target pages, sorted by referring domains
    const { body: pagesBody, fullAuditRef } = await this.sendRawRequest({
      type: epPages.type,
      target: url,
      target_type: 'root_domain',
      export_columns: epPages.columns,
      display_limit: effectiveLimit,
      display_filter: buildFilter([{
        sign: '+', field: 'responsecode', op: 'Eq', value: '404',
      }]),
      ...epPages.defaultParams,
    }, epPages.path);
    const brokenPages = parseCsvResponse(pagesBody);

    if (brokenPages.length === 0) {
      return { result: { backlinks: [] }, fullAuditRef };
    }

    // Step 2: For each broken page, fetch the top backlink by authority score.
    const brokenUrls = brokenPages.map((p) => p.source_url);
    const linkResults = await this.fanOut(brokenUrls, (brokenUrl) => this.sendRawRequest({
      type: epLinks.type,
      target: brokenUrl,
      target_type: 'url',
      export_columns: epLinks.columns,
      display_limit: 1,
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
  async getMetricsByCountry(url, date = lastMonthISO()) {
    return STUB_RESPONSE;
  }
}
