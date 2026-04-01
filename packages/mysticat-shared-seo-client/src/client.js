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

import { isValidUrl } from '@adobe/spacecat-shared-utils';
import { context as h2, h1 } from '@adobe/fetch';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();

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

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async sendRequest(endpoint, queryParams = {}) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getBrokenBacklinks(url, limit = 50) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getTopPages(url, limit = 200) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getBacklinks(url, limit = 200) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getOrganicKeywords(url, options = {}) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getPaidPages(url, date = new Date().toISOString().split('T')[0], limit = 200, mode = 'prefix') {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getMetrics(url, date = new Date().toISOString().split('T')[0]) {
    return STUB_RESPONSE;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getMetricsByCountry(url, date = new Date().toISOString().split('T')[0]) {
    return STUB_RESPONSE;
  }
}
