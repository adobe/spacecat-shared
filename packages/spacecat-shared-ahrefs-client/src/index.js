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

import { hasText, isValidUrl, isArray } from '@adobe/spacecat-shared-utils';
import { context as h2, h1 } from '@adobe/fetch';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();

const getLimit = (limit, upperLimit) => Math.min(limit, upperLimit);

export const ORGANIC_KEYWORDS_FIELDS = /** @type {const} */ ([
  'keyword',
  'keyword_country',
  'language',
  'sum_traffic',
  'volume',
  'best_position',
  'best_position_url',
  'cpc',
  'last_update',
  'is_branded',
  'is_navigational',
  'is_informational',
  'is_commercial',
  'is_transactional',
  'serp_features',
]);

export const METRICS_BY_COUNTRY_FILTER_FIELDS = /** @type {const} */ ([
  'org_keywords',
  'paid_keywords',
  'org_keywords_1_3',
  'org_traffic',
  'org_cost',
  'paid_traffic',
  'paid_cost',
  'paid_pages',
]);

export default class AhrefsAPIClient {
  static createFrom(context) {
    const { AHREFS_API_BASE_URL: apiBaseUrl, AHREFS_API_KEY: apiKey } = context.env;
    return new AhrefsAPIClient({ apiBaseUrl, apiKey }, fetch, context.log);
  }

  constructor(config, fetchAPI, log = console) {
    const { apiKey, apiBaseUrl } = config;

    if (!isValidUrl(apiBaseUrl)) {
      throw new Error(`Invalid Ahrefs API Base URL: ${apiBaseUrl}`);
    }

    if (typeof fetchAPI !== 'function') {
      throw Error('"fetchAPI" must be a function');
    }

    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
    this.fetchAPI = fetchAPI;
    this.log = log;
  }

  async sendRequest(endpoint, queryParams = {}) {
    const queryParamsKeys = Object.keys(queryParams);
    const queryString = queryParamsKeys.length > 0
      ? `?${queryParamsKeys
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
        .join('&')}` : '';

    const fullAuditRef = `${this.apiBaseUrl}${endpoint}${queryString}`;
    const response = await this.fetchAPI(fullAuditRef, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    this.log.info(`Ahrefs API ${endpoint} response has number of rows: ${response.headers.get('x-api-rows')}, `
      + `cost per row: ${response.headers.get('x-api-units-cost-row')}, `
      + `total cost: ${response.headers.get('x-api-units-cost-total-actual')}`);

    if (!response.ok) {
      let errorMessage = `Ahrefs API request failed with status: ${response.status}`;
      try {
        const errorBody = await response.json();
        if (hasText(errorBody.error)) {
          errorMessage += ` - ${errorBody.error}`;
        }
      } catch (e) {
        this.log.error(`Error parsing Ahrefs API error response: ${e.message}`);
      }
      this.log.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const result = await response.json();
      return {
        result,
        fullAuditRef,
      };
    } catch (e) {
      this.log.error(`Error parsing Ahrefs API response: ${e.message}`, e);
      throw new Error(`Error parsing Ahrefs API response: ${e.message}`);
    }
  }

  async getBrokenBacklinks(url, limit = 50) {
    const filter = {
      and: [
        { field: 'domain_rating_source', is: ['gte', 29.5] },
        { field: 'traffic_domain', is: ['gte', 500] },
        { field: 'links_external', is: ['lte', 300] },
      ],
    };

    const queryParams = {
      select: [
        'title',
        'url_from',
        'url_to',
        'traffic_domain',
      ].join(','),
      limit: getLimit(limit, 100),
      mode: 'prefix',
      order_by: 'domain_rating_source:desc,traffic_domain:desc',
      target: url,
      output: 'json',
      where: JSON.stringify(filter),
    };

    return this.sendRequest('/site-explorer/broken-backlinks', queryParams);
  }

  async getTopPages(url, limit = 200) {
    const filter = {
      and: [
        { field: 'sum_traffic', is: ['gt', 0] },
      ],
    };

    const queryParams = {
      select: [
        'url',
        'sum_traffic',
        'top_keyword',
      ].join(','),
      order_by: 'sum_traffic',
      date: new Date().toISOString().split('T')[0],
      target: url,
      limit: getLimit(limit, 2000),
      mode: 'prefix',
      output: 'json',
      where: JSON.stringify(filter),
    };

    return this.sendRequest('/site-explorer/top-pages', queryParams);
  }

  async getBacklinks(url, limit = 200) {
    const filter = {
      and: [
        { field: 'domain_rating_source', is: ['gte', 29.5] },
        { field: 'traffic_domain', is: ['gte', 500] },
        { field: 'links_external', is: ['lte', 300] },
      ],
    };

    const queryParams = {
      select: [
        'title',
        'url_from',
        'url_to',
      ].join(','),
      order_by: 'domain_rating_source:desc,traffic_domain:desc',
      target: url,
      limit: getLimit(limit, 1000),
      mode: 'prefix',
      output: 'json',
      where: JSON.stringify(filter),
    };

    return this.sendRequest('/site-explorer/all-backlinks', queryParams);
  }

  async getOrganicTraffic(url, startDate, endDate) {
    const queryParams = {
      target: url,
      date_from: startDate,
      date_to: endDate,
      history_grouping: 'weekly',
      volume_mode: 'average',
      mode: 'prefix',
      output: 'json',
    };

    return this.sendRequest('/site-explorer/metrics-history', queryParams);
  }

  async getOrganicKeywords(url, {
    country = 'us',
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
    this.log.debug(`Getting organic keywords for ${url} with country ${country}, mode ${mode}, limit ${limit}, excludeBranded ${excludeBranded} and select:${ORGANIC_KEYWORDS_FIELDS.join(',')}`);

    const queryParams = {
      country,
      date: new Date().toISOString().split('T')[0],
      select: ORGANIC_KEYWORDS_FIELDS.join(','),
      order_by: 'sum_traffic:desc',
      target: url,
      limit: getLimit(limit, 100),
      mode,
      output: 'json',
    };
    let where;
    if (keywordFilter.length > 0) {
      where = {
        or: keywordFilter.map((keyword) => ({ field: 'keyword', is: ['iphrase_match', keyword] })),
      };
    }
    if (excludeBranded) {
      const nonBrandedWhere = { field: 'is_branded', is: ['eq', 0] };
      if (where) {
        where = { and: [nonBrandedWhere, where] };
      } else {
        where = nonBrandedWhere;
      }
    }
    if (where != null) {
      try {
        queryParams.where = JSON.stringify(where);
      } catch (e) {
        this.log.error(`Error parsing keyword filter: ${e.message}`);
        throw new Error(`Error parsing keyword filter: ${e.message}`);
      }
    }

    return this.sendRequest('/site-explorer/organic-keywords', queryParams);
  }

  /**
   * Retrieves pages with paid search traffic for a given URL.
   *
   * @param {string} url - The target URL to analyze
   * @param {string} [date] - The date for the analysis in YYYY-MM-DD format.
   *                          Defaults to today's date.
   * @param {number} [limit=200] - Maximum number of results to return (max: 1000)
   * @param {string} [mode='prefix'] - Search mode: 'exact' for exact domain match,
   *                                   'prefix' for domain and all subpages
   * @returns {Promise<{result: Object, fullAuditRef: string}>} Response object containing:
   *   - result.pages: Array of paid page objects with properties:
   *     - url: The page URL
   *     - top_keyword: The keyword that brings the most paid traffic to a page.
   *     - top_keyword_best_position_title: The title displayed for the page in its top
   *       keyword's SERP.
   *     - top_keyword_country: The country in which a page ranks for its top keyword
   *     - top_keyword_volume: An estimation of the average monthly number of
   *                           searches for the top keyword over the latest month
   *     - sum_traffic: An estimation of the monthly paid search traffic that a page gets from
   *       all the keywords that it ranks for.
   *     - value: The estimated cost of a page's monthly paid search traffic, in USD cents.
   *   - fullAuditRef: Full URL of the API request for reference
   * @example
   * // Using defaults (today's date, limit 200, prefix mode)
   * const result = await client.getPaidPages('example.com');
   *
   * // With custom parameters
   * const result = await client.getPaidPages('example.com', '2025-11-10', 50, 'exact');
   * console.log(result.result.pages); // Array of paid pages
   */
  async getPaidPages(url, date = new Date().toISOString().split('T')[0], limit = 200, mode = 'prefix') {
    const queryParams = {
      target: url,
      date,
      select: [
        'url',
        'top_keyword',
        'top_keyword_best_position_title',
        'top_keyword_country',
        'top_keyword_volume',
        'sum_traffic',
        'value',
      ].join(','),
      order_by: 'sum_traffic:desc',
      limit: getLimit(limit, 1000),
      mode,
      output: 'json',
    };

    return this.sendRequest('/site-explorer/paid-pages', queryParams);
  }

  /**
   * Retrieves overall metrics for a given target URL.
   *
   * @param {string} url - The target URL to analyze
   * @param {string} [date] - The date for the analysis in YYYY-MM-DD format.
   *                          Defaults to today's date.
   * @returns {Promise<{result: Object, fullAuditRef: string}>} Response object containing:
   *   - result.metrics: Object with overall metrics:
   *     - org_keywords: The total number of keywords that your target ranks for in the top 100
   *       organic search results.
   *     - paid_keywords: The total number of keywords that your target ranks for in paid
   *       search results.
   *     - org_keywords_1_3: The total number of keywords that your target ranks for in the
   *       top 3 organic search results.
   *     - org_traffic: The estimated number of monthly visitors that your target gets from
   *       organic search.
   *     - org_cost: The estimated value of your target's monthly organic search traffic,
   *       in USD cents.
   *     - paid_traffic: The estimated number of monthly visitors that your target gets from
   *       paid search.
   *     - paid_cost: The estimated cost of your target's monthly paid search traffic,
   *       in USD cents.
   *     - paid_pages: The total number of pages from a target ranking in paid search results.
   *   - fullAuditRef: Full URL of the API request for reference
   * @example
   * const result = await client.getMetrics('example.com', '2025-11-10');
   * console.log(result.result.metrics.org_traffic); // Organic traffic value
   */
  async getMetrics(url, date = new Date().toISOString().split('T')[0]) {
    const queryParams = {
      target: url,
      date,
    };

    return this.sendRequest('/site-explorer/metrics', queryParams);
  }

  /**
   * Retrieves metrics broken down by country for a given target URL.
   * Automatically filters out countries where both organic and paid traffic are zero.
   *
   * @param {string} url - The target URL to analyze
   * @param {string} [date] - The date for the analysis in YYYY-MM-DD format.
   *                          Defaults to today's date.
   * @returns {Promise<{result: Object, fullAuditRef: string}>} Response object containing:
   *   - result.metrics: Array of metric objects, each containing:
   *     - country: Two-letter country code (e.g., "US", "IN")
   *     - org_keywords: The total number of keywords that your target ranks for in the
   *       top 100 organic search results in this country.
   *     - paid_keywords: The total number of keywords that your target ranks for in paid
   *       search results in this country.
   *     - org_keywords_1_3: The total number of keywords that your target ranks for in the
   *       top 3 organic search results in this country.
   *     - org_traffic: The estimated number of monthly visitors that your target gets from
   *       organic search in this country.
   *     - org_cost: The estimated value of your target's monthly organic search traffic
   *       from this country, in USD cents.
   *     - paid_traffic: The estimated number of monthly visitors that your target gets from
   *       paid search in this country.
   *     - paid_cost: The estimated cost of your target's monthly paid search traffic from
   *       this country, in USD cents.
   *     - paid_pages: The total number of pages from a target ranking in paid search
   *       results in this country.
   *   - fullAuditRef: Full URL of the API request for reference
   * @example
   * const result = await client.getMetricsByCountry('example.com', '2025-11-10');
   * console.log(result.result.metrics); // Array of metrics by country (excluding zeros)
   */
  async getMetricsByCountry(url, date = new Date().toISOString().split('T')[0]) {
    const queryParams = {
      target: url,
      date,
    };

    const response = await this.sendRequest('/site-explorer/metrics-by-country', queryParams);

    // Filter out countries where all metric values are 0 or null
    if (response.result?.metrics) {
      response.result.metrics = response.result.metrics
        .filter((metric) => METRICS_BY_COUNTRY_FILTER_FIELDS.some((field) => {
          const value = metric[field];
          return value !== null && value !== 0;
        }));
    }

    return response;
  }

  async getLimitsAndUsage() {
    return this.sendRequest('/subscription-info/limits-and-usage');
  }
}
