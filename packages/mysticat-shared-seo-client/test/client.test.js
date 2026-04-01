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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import SeoClient from '../src/client.js';

use(chaiAsPromised);
const sandbox = sinon.createSandbox();

describe('SeoClient', () => {
  const config = {
    apiKey: 'test-api-key',
    apiBaseUrl: 'https://seo-api.example.com',
  };

  const mockFetch = () => {};
  const mockLog = {
    info: sandbox.stub(),
    error: sandbox.stub(),
    debug: sandbox.stub(),
  };

  afterEach(() => {
    sandbox.restore();
  });

  describe('createFrom', () => {
    it('creates an instance from context', () => {
      const context = {
        env: {
          SEO_API_BASE_URL: 'https://seo-api.example.com',
          SEO_API_KEY: 'my-api-key',
        },
        log: mockLog,
      };

      const client = SeoClient.createFrom(context);
      expect(client).to.be.an.instanceOf(SeoClient);
    });

    it('throws when SEO_API_BASE_URL is missing', () => {
      const context = {
        env: { SEO_API_KEY: 'key' },
        log: mockLog,
      };

      expect(() => SeoClient.createFrom(context))
        .to.throw('Invalid SEO API Base URL');
    });

    it('throws when SEO_API_BASE_URL is not a valid URL', () => {
      const context = {
        env: { SEO_API_BASE_URL: 'not-a-url', SEO_API_KEY: 'key' },
        log: mockLog,
      };

      expect(() => SeoClient.createFrom(context))
        .to.throw('Invalid SEO API Base URL');
    });
  });

  describe('constructor', () => {
    it('stores config, fetchAPI and log', () => {
      const client = new SeoClient(config, mockFetch, mockLog);
      expect(client.apiBaseUrl).to.equal(config.apiBaseUrl);
      expect(client.apiKey).to.equal(config.apiKey);
      expect(client.fetchAPI).to.equal(mockFetch);
      expect(client.log).to.equal(mockLog);
    });

    it('defaults log to console', () => {
      const client = new SeoClient(config, mockFetch);
      expect(client.log).to.equal(console);
    });

    it('throws when apiBaseUrl is invalid', () => {
      expect(() => new SeoClient({ apiKey: 'key', apiBaseUrl: 'bad' }, mockFetch))
        .to.throw('Invalid SEO API Base URL');
    });

    it('throws when fetchAPI is not a function', () => {
      expect(() => new SeoClient(config, 'not-a-function'))
        .to.throw('"fetchAPI" must be a function');
    });
  });

  describe('stub methods', () => {
    let client;

    beforeEach(() => {
      client = new SeoClient(config, mockFetch, mockLog);
    });

    it('sendRequest returns stub response', async () => {
      const result = await client.sendRequest('/test', { foo: 'bar' });
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getBrokenBacklinks returns stub response', async () => {
      const result = await client.getBrokenBacklinks('https://example.com', 50);
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getTopPages returns stub response', async () => {
      const result = await client.getTopPages('https://example.com', 200);
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getBacklinks returns stub response', async () => {
      const result = await client.getBacklinks('https://example.com', 200);
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getOrganicKeywords returns stub response', async () => {
      const result = await client.getOrganicKeywords('https://example.com', {
        country: 'us',
        limit: 10,
      });
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getOrganicKeywords works with no options', async () => {
      const result = await client.getOrganicKeywords('https://example.com');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getPaidPages returns stub response', async () => {
      const result = await client.getPaidPages('https://example.com', '2025-01-01', 200, 'prefix');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getPaidPages works with defaults', async () => {
      const result = await client.getPaidPages('https://example.com');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getMetrics returns stub response', async () => {
      const result = await client.getMetrics('https://example.com', '2025-01-01');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getMetrics works with defaults', async () => {
      const result = await client.getMetrics('https://example.com');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getMetricsByCountry returns stub response', async () => {
      const result = await client.getMetricsByCountry('https://example.com', '2025-01-01');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getMetricsByCountry works with defaults', async () => {
      const result = await client.getMetricsByCountry('https://example.com');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });
  });

  describe('index exports', () => {
    let indexModule;

    before(async () => {
      indexModule = await import('../src/index.js');
    });

    it('exports SeoClient as default', () => {
      expect(indexModule.default).to.equal(SeoClient);
    });

    it('exports fetch function', () => {
      expect(indexModule.fetch).to.be.a('function');
    });

    it('exports ENDPOINTS', () => {
      expect(indexModule.ENDPOINTS).to.be.an('object');
    });

    it('exports buildQueryParams', () => {
      expect(indexModule.buildQueryParams).to.be.a('function');
    });

    it('exports parseResponse', () => {
      expect(indexModule.parseResponse).to.be.a('function');
    });

    it('exports ORGANIC_KEYWORDS_FIELDS as empty array', () => {
      expect(indexModule.ORGANIC_KEYWORDS_FIELDS).to.be.an('array').that.is.empty;
    });

    it('exports METRICS_BY_COUNTRY_FILTER_FIELDS as empty array', () => {
      expect(indexModule.METRICS_BY_COUNTRY_FILTER_FIELDS).to.be.an('array').that.is.empty;
    });
  });
});
