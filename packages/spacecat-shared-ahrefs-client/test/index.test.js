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

/* eslint-env mocha */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';

import AhrefsAPIClient, { fetch, ORGANIC_KEYWORDS_FIELDS } from '../src/index.js';

use(chaiAsPromised);
const sandbox = sinon.createSandbox();

const mockDate = '2023-03-12T15:24:51.231Z';

describe('AhrefsAPIClient', () => {
  let client;

  const config = {
    apiKey: 'testApiKey',
    apiBaseUrl: 'https://example.com',
  };

  const backlinksResponse = {
    backlinks: [
      {
        title: 'backlink title',
        url_from: 'url-from',
        url_to: 'url-to',
      },
      {
        title: 'backlink title 2',
        url_from: 'url-from-2',
        url_to: 'url-to-2',
      },
    ],
  };

  const topPagesResponse = {
    pages: [
      {
        url: 'page-url-1',
        sum_traffic: 100,
        top_keyword: 'keyword1',
      },
      {
        url: 'page-url-2',
        sum_traffic: 300,
        top_keyword: 'keyword2',
      },
    ],
  };

  const organicTrafficMetricsResponse = {
    metrics: [
      {
        date: '2024-01-29T00:00:00Z',
        org_traffic: 179364,
        paid_traffic: 72,
        org_cost: 11284251,
        paid_cost: 2675,
      },
      {
        date: '2024-02-05T00:00:00Z',
        org_traffic: 176236,
        paid_traffic: 52,
        org_cost: 10797893,
        paid_cost: 1724,
      },
    ],
  };

  const organicKeywordsResponse = {
    keywords: [
      {
        keyword: 'keyword1',
        sum_traffic: 100,
        best_position_url: 'url1',
        best_position: 1,
        volume: 61000,
        cpc: 423,
        is_branded: true,
      },
      {
        keyword: 'keyword2',
        sum_traffic: 200,
        best_position_url: 'url2',
        best_position: 7,
        volume: 89000,
        cpc: 34,
        is_branded: false,
      },
    ],
  };

  const limitsUsageResponse = {
    limits_and_usage: {
      subscription: 'Enterprise, billed yearly',
      usage_reset_date: '2024-08-28T00:00:00Z',
      units_limit_workspace: 12000000,
      units_usage_workspace: 6618294,
      units_limit_api_key: 1000000,
      units_usage_api_key: 198771,
      api_key_expiration_date: '2025-01-04T17:44:07Z',
    },
  };

  const paidPagesResponse = {
    pages: [
      {
        url: 'https://example.com/page1',
        top_keyword: 'keyword1',
        top_keyword_best_position_title: 'Page 1 Title',
        top_keyword_country: 'US',
        top_keyword_volume: 1000,
        sum_traffic: 500,
        value: 12345,
      },
      {
        url: 'https://example.com/page2',
        top_keyword: 'keyword2',
        top_keyword_best_position_title: 'Page 2 Title',
        top_keyword_country: 'US',
        top_keyword_volume: 2000,
        sum_traffic: 800,
        value: 23456,
      },
    ],
  };

  const metricsResponse = {
    metrics: {
      org_keywords: 21277,
      paid_keywords: 721,
      org_keywords_1_3: 3291,
      org_traffic: 518546,
      org_cost: 15856429,
      paid_traffic: 5125,
      paid_cost: 394641,
      paid_pages: 73,
    },
  };

  const metricsByCountryResponse = {
    metrics: [
      {
        country: 'US',
        org_keywords: 10000,
        paid_keywords: 500,
        org_keywords_1_3: 2000,
        org_traffic: 300000,
        org_cost: 8000000,
        paid_traffic: 3000,
        paid_cost: 200000,
        paid_pages: 50,
      },
      {
        country: 'GB',
        org_keywords: 5000,
        paid_keywords: 200,
        org_keywords_1_3: 1000,
        org_traffic: 150000,
        org_cost: 4000000,
        paid_traffic: 1500,
        paid_cost: 100000,
        paid_pages: 20,
      },
      {
        country: 'FR',
        org_keywords: 0,
        paid_keywords: 0,
        org_keywords_1_3: 0,
        org_traffic: 0,
        org_cost: 0,
        paid_traffic: 0,
        paid_cost: 0,
        paid_pages: 0,
      },
    ],
  };

  before('setup', function () {
    this.clock = sandbox.useFakeTimers({
      now: new Date(mockDate).getTime(),
      shouldAdvanceTime: true,
    });
  });

  after('clean', function () {
    this.clock.uninstall();
  });

  beforeEach(() => {
    client = new AhrefsAPIClient(config, fetch);
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws error when api base url is missing', () => {
      expect(() => new AhrefsAPIClient({})).to.throw('Invalid Ahrefs API Base URL: undefined');
    });

    it('throws error when fetch is not a function', () => {
      expect(() => new AhrefsAPIClient(config, 'fetch')).to.throw('"fetchAPI" must be a function');
    });
  });

  describe('createFrom', () => {
    it('creates an instance of AhrefsAPIClient', () => {
      const context = {
        env: {
          AHREFS_API_BASE_URL: 'https://example.com',
          AHREFS_API_KEY: 'testApiKey',
        },
      };

      const ahrefsAPIClient = AhrefsAPIClient.createFrom(context);
      expect(ahrefsAPIClient).to.be.instanceOf(AhrefsAPIClient);
    });
  });

  describe('sendRequest', () => {
    it('returns data when API request was successful', async () => {
      nock(config.apiBaseUrl)
        .get(/.*/)
        .reply(200, backlinksResponse);

      const result = await client.sendRequest('/some-endpoint');
      expect(result).to.deep.equal({
        result: backlinksResponse,
        fullAuditRef: 'https://example.com/some-endpoint',
      });
    });

    it('throw error when API response is not ok', async () => {
      nock(config.apiBaseUrl)
        .get(/.*/)
        .reply(400, { error: 'bad where: invalid filter expression' });

      await expect(client.sendRequest('/some-endpoint')).to.be.rejectedWith('Ahrefs API request failed with status: 400 - bad where: invalid filter expression');
    });

    it('throw error when API error response body cannot be parsed as JSON', async () => {
      nock(config.apiBaseUrl)
        .get(/.*/)
        .reply(400, 'invalid-json');

      await expect(client.sendRequest('/some-endpoint')).to.be.rejectedWith('Ahrefs API request failed with status: 400');
    });

    it('throw error when API response body cannot be parsed as JSON', async () => {
      nock(config.apiBaseUrl)
        .get(/.*/)
        .reply(200, 'invalid-json');

      await expect(client.sendRequest('/some-endpoint')).to.be.rejectedWith('Error parsing Ahrefs API response:');
    });
  });

  describe('getBrokenBacklinks', () => {
    it('sends API request with appropriate endpoint query params', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/broken-backlinks')
        .query({
          select: [
            'title',
            'url_from',
            'url_to',
            'traffic_domain',
          ].join(','),
          limit: 50,
          mode: 'prefix',
          order_by: 'domain_rating_source:desc,traffic_domain:desc',
          target: 'test-site.com',
          output: 'json',
          where: JSON.stringify({
            and: [
              { field: 'domain_rating_source', is: ['gte', 29.5] },
              { field: 'traffic_domain', is: ['gte', 500] },
              { field: 'links_external', is: ['lte', 300] },
            ],
          }),
        })
        .reply(200, backlinksResponse);

      const result = await client.getBrokenBacklinks('test-site.com');
      expect(result).to.deep.equal({
        result: backlinksResponse,
        fullAuditRef: 'https://example.com/site-explorer/broken-backlinks?select=title%2Curl_from%2Curl_to%2Ctraffic_domain&limit=50&mode=prefix&order_by=domain_rating_source%3Adesc%2Ctraffic_domain%3Adesc&target=test-site.com&output=json&where=%7B%22and%22%3A%5B%7B%22field%22%3A%22domain_rating_source%22%2C%22is%22%3A%5B%22gte%22%2C29.5%5D%7D%2C%7B%22field%22%3A%22traffic_domain%22%2C%22is%22%3A%5B%22gte%22%2C500%5D%7D%2C%7B%22field%22%3A%22links_external%22%2C%22is%22%3A%5B%22lte%22%2C300%5D%7D%5D%7D',
      });
    });
  });

  describe('getTopPages', () => {
    it('sends API request with appropriate endpoint query params', async () => {
      const specifiedLimit = 50;
      const target = 'test-site.com';

      const date = mockDate.split('T')[0];
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
        where: JSON.stringify(filter),
        order_by: 'sum_traffic',
        date,
        target,
        limit: specifiedLimit,
        mode: 'prefix',
        output: 'json',
      };

      nock(config.apiBaseUrl)
        .get('/site-explorer/top-pages')
        .query(queryParams)
        .reply(200, topPagesResponse);

      const result = await client.getTopPages(target, specifiedLimit);
      expect(result).to.deep.equal({
        result: topPagesResponse,
        fullAuditRef: `https://example.com/site-explorer/top-pages?select=url%2Csum_traffic%2Ctop_keyword&order_by=sum_traffic&date=${date}&target=${target}&limit=${specifiedLimit}&mode=prefix&output=json&where=%7B%22and%22%3A%5B%7B%22field%22%3A%22sum_traffic%22%2C%22is%22%3A%5B%22gt%22%2C0%5D%7D%5D%7D`,
      });
    });
  });

  describe('getBacklinks', () => {
    it('sends API request with appropriate endpoint query params', async () => {
      const upperLimit = 1000;

      nock(config.apiBaseUrl)
        .get('/site-explorer/all-backlinks')
        .query({
          select: [
            'title',
            'url_from',
            'url_to',
          ].join(','),
          limit: upperLimit,
          mode: 'prefix',
          order_by: 'domain_rating_source:desc,traffic_domain:desc',
          target: 'test-site.com',
          output: 'json',
          where: JSON.stringify({
            and: [
              { field: 'domain_rating_source', is: ['gte', 29.5] },
              { field: 'traffic_domain', is: ['gte', 500] },
              { field: 'links_external', is: ['lte', 300] },
            ],
          }),
        })
        .reply(200, backlinksResponse);

      const result = await client.getBacklinks('test-site.com', upperLimit * 3);
      expect(result).to.deep.equal({
        result: backlinksResponse,
        fullAuditRef: `https://example.com/site-explorer/all-backlinks?select=title%2Curl_from%2Curl_to&order_by=domain_rating_source%3Adesc%2Ctraffic_domain%3Adesc&target=test-site.com&limit=${upperLimit}&mode=prefix&output=json&where=%7B%22and%22%3A%5B%7B%22field%22%3A%22domain_rating_source%22%2C%22is%22%3A%5B%22gte%22%2C29.5%5D%7D%2C%7B%22field%22%3A%22traffic_domain%22%2C%22is%22%3A%5B%22gte%22%2C500%5D%7D%2C%7B%22field%22%3A%22links_external%22%2C%22is%22%3A%5B%22lte%22%2C300%5D%7D%5D%7D`,
      });
    });
  });

  describe('getOrganicTraffic', () => {
    it('sends API request with appropriate endpoint query params', async () => {
      const startDate = '2024-01-29';
      const endDate = '2024-02-05';

      nock(config.apiBaseUrl)
        .get('/site-explorer/metrics-history')
        .query({
          target: 'test-site.com',
          date_from: startDate,
          date_to: endDate,
          history_grouping: 'weekly',
          volume_mode: 'average',
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, organicTrafficMetricsResponse);

      const result = await client.getOrganicTraffic('test-site.com', startDate, endDate);
      expect(result).to.deep.equal({
        result: organicTrafficMetricsResponse,
        fullAuditRef: 'https://example.com/site-explorer/metrics-history?target=test-site.com&date_from=2024-01-29&date_to=2024-02-05&history_grouping=weekly&volume_mode=average&mode=prefix&output=json',
      });
    });
  });

  describe('getOrganicKeywords', () => {
    it('sends API request with appropriate endpoint query params', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 100,
          mode: 'prefix',
          output: 'json',
          where: JSON.stringify({
            or: [
              { field: 'keyword', is: ['iphrase_match', 'keyword1'] },
              { field: 'keyword', is: ['iphrase_match', 'keyword2'] },
            ],
          }),
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com', {
        country: 'us',
        keywordFilter: ['keyword1', 'keyword2'],
        limit: 100,
      });

      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=100&mode=prefix&output=json&where=%7B%22or%22%3A%5B%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword1%22%5D%7D%2C%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword2%22%5D%7D%5D%7D`,
      });
    });

    it('sends API request with no keyword filter if none are specified', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 10,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com');

      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=10&mode=prefix&output=json`,
      });
    });

    it('sends API request with exact mode when specified', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 50,
          mode: 'exact',
          output: 'json',
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com', {
        country: 'us', keywordFilter: [], limit: 50, mode: 'exact',
      });

      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=50&mode=exact&output=json`,
      });
    });

    it('sends API request with upper limit when a limit > upper limit is specified', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 100,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com', { country: 'us', keywordFilter: [], limit: 5000 });

      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=100&mode=prefix&output=json`,
      });
    });

    it('sends an API request for non-branded keywords only if specified', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 10,
          mode: 'prefix',
          output: 'json',
          where: '{"field":"is_branded","is":["eq",0]}',
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com', { country: 'us', excludeBranded: true });
      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=10&mode=prefix&output=json&where=%7B%22field%22%3A%22is_branded%22%2C%22is%22%3A%5B%22eq%22%2C0%5D%7D`,
      });
    });

    it('supports combining keyword filters and non-branded keywords', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: ORGANIC_KEYWORDS_FIELDS.join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 10,
          mode: 'prefix',
          output: 'json',
          where: JSON.stringify({
            and: [
              { field: 'is_branded', is: ['eq', 0] },
              {
                or: [
                  { field: 'keyword', is: ['iphrase_match', 'keyword1'] },
                  { field: 'keyword', is: ['iphrase_match', 'keyword2'] },
                ],
              },
            ],
          }),
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com', {
        country: 'us', keywordFilter: ['keyword1', 'keyword2'], excludeBranded: true,
      });

      expect(result).to.deep.equal({
        result: organicKeywordsResponse,
        fullAuditRef: `https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=${ORGANIC_KEYWORDS_FIELDS.join('%2C')}&order_by=sum_traffic%3Adesc&target=test-site.com&limit=10&mode=prefix&output=json&where=%7B%22and%22%3A%5B%7B%22field%22%3A%22is_branded%22%2C%22is%22%3A%5B%22eq%22%2C0%5D%7D%2C%7B%22or%22%3A%5B%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword1%22%5D%7D%2C%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword2%22%5D%7D%5D%7D%5D%7D`,
      });
    });

    it('throws error when keyword filter does not contain appropriate keyword items', async () => {
      const result = client.getOrganicKeywords('test-site.com', { country: 'us', keywordFilter: [BigInt(123)] });
      await expect(result).to.be.rejectedWith('Error parsing keyword filter: Do not know how to serialize a BigInt');
    });

    it('throws error when keyword filter is not an array', async () => {
      const result = client.getOrganicKeywords('test-site.com', { country: 'us', keywordFilter: 'keyword1' });
      await expect(result).to.be.rejectedWith('Invalid keyword filter: keyword1');
    });

    it('throws error when url is not a string', async () => {
      const result = client.getOrganicKeywords(123);
      await expect(result).to.be.rejectedWith('Invalid URL: 123');
    });

    it('throws error when country is not a string', async () => {
      const result = client.getOrganicKeywords('test-site.com', { country: 123 });
      await expect(result).to.be.rejectedWith('Invalid country: 123');
    });

    it('throws error when limit is not an integer', async () => {
      const result = client.getOrganicKeywords('test-site.com', { country: 'us', keywordFilter: [], limit: 1.5 });
      await expect(result).to.be.rejectedWith('Invalid limit: 1.5');
    });

    it('throws error when mode is invalid', async () => {
      const result = client.getOrganicKeywords('test-site.com', {
        country: 'us', keywordFilter: [], limit: 200, mode: 'invalid-mode',
      });
      await expect(result).to.be.rejectedWith('Invalid mode: invalid-mode');
    });
  });

  describe('getPaidPages', () => {
    it('sends API request with appropriate endpoint and default params', async () => {
      const target = 'test-site.com';
      const date = mockDate.split('T')[0];

      nock(config.apiBaseUrl)
        .get('/site-explorer/paid-pages')
        .query({
          target,
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
          limit: 200,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, paidPagesResponse);

      const result = await client.getPaidPages(target);
      expect(result).to.deep.equal({
        result: paidPagesResponse,
        fullAuditRef: `https://example.com/site-explorer/paid-pages?target=${target}&date=${date}&select=url%2Ctop_keyword%2Ctop_keyword_best_position_title%2Ctop_keyword_country%2Ctop_keyword_volume%2Csum_traffic%2Cvalue&order_by=sum_traffic%3Adesc&limit=200&mode=prefix&output=json`,
      });
    });

    it('sends API request with custom date and limit', async () => {
      const target = 'test-site.com';
      const customDate = '2025-11-10';
      const customLimit = 500;

      nock(config.apiBaseUrl)
        .get('/site-explorer/paid-pages')
        .query({
          target,
          date: customDate,
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
          limit: customLimit,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, paidPagesResponse);

      const result = await client.getPaidPages(target, customDate, customLimit);
      expect(result).to.deep.equal({
        result: paidPagesResponse,
        fullAuditRef: `https://example.com/site-explorer/paid-pages?target=${target}&date=${customDate}&select=url%2Ctop_keyword%2Ctop_keyword_best_position_title%2Ctop_keyword_country%2Ctop_keyword_volume%2Csum_traffic%2Cvalue&order_by=sum_traffic%3Adesc&limit=${customLimit}&mode=prefix&output=json`,
      });
    });

    it('respects upper limit of 1000', async () => {
      const target = 'test-site.com';
      const date = mockDate.split('T')[0];

      nock(config.apiBaseUrl)
        .get('/site-explorer/paid-pages')
        .query({
          target,
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
          limit: 1000,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, paidPagesResponse);

      const result = await client.getPaidPages(target, date, 5000);
      expect(result).to.deep.equal({
        result: paidPagesResponse,
        fullAuditRef: `https://example.com/site-explorer/paid-pages?target=${target}&date=${date}&select=url%2Ctop_keyword%2Ctop_keyword_best_position_title%2Ctop_keyword_country%2Ctop_keyword_volume%2Csum_traffic%2Cvalue&order_by=sum_traffic%3Adesc&limit=1000&mode=prefix&output=json`,
      });
    });

    it('sends API request with custom mode parameter', async () => {
      const target = 'test-site.com';
      const date = mockDate.split('T')[0];
      const customMode = 'exact';

      nock(config.apiBaseUrl)
        .get('/site-explorer/paid-pages')
        .query({
          target,
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
          limit: 200,
          mode: customMode,
          output: 'json',
        })
        .reply(200, paidPagesResponse);

      const result = await client.getPaidPages(target, date, 200, customMode);
      expect(result).to.deep.equal({
        result: paidPagesResponse,
        fullAuditRef: `https://example.com/site-explorer/paid-pages?target=${target}&date=${date}&select=url%2Ctop_keyword%2Ctop_keyword_best_position_title%2Ctop_keyword_country%2Ctop_keyword_volume%2Csum_traffic%2Cvalue&order_by=sum_traffic%3Adesc&limit=200&mode=${customMode}&output=json`,
      });
    });
  });

  describe('getMetrics', () => {
    it('sends API request with appropriate endpoint and default date', async () => {
      const target = 'test-site.com';
      const date = mockDate.split('T')[0];

      nock(config.apiBaseUrl)
        .get('/site-explorer/metrics')
        .query({
          target,
          date,
        })
        .reply(200, metricsResponse);

      const result = await client.getMetrics(target);
      expect(result).to.deep.equal({
        result: metricsResponse,
        fullAuditRef: `https://example.com/site-explorer/metrics?target=${target}&date=${date}`,
      });
    });

    it('sends API request with custom date', async () => {
      const target = 'test-site.com';
      const customDate = '2025-11-10';

      nock(config.apiBaseUrl)
        .get('/site-explorer/metrics')
        .query({
          target,
          date: customDate,
        })
        .reply(200, metricsResponse);

      const result = await client.getMetrics(target, customDate);
      expect(result).to.deep.equal({
        result: metricsResponse,
        fullAuditRef: `https://example.com/site-explorer/metrics?target=${target}&date=${customDate}`,
      });
    });
  });

  describe('getMetricsByCountry', () => {
    it('sends API request with appropriate endpoint and filters out zero metrics', async () => {
      const target = 'test-site.com';
      const date = mockDate.split('T')[0];

      nock(config.apiBaseUrl)
        .get('/site-explorer/metrics-by-country')
        .query({
          target,
          date,
        })
        .reply(200, metricsByCountryResponse);

      const result = await client.getMetricsByCountry(target);

      // Should filter out the FR entry with all zeros
      expect(result.result.metrics).to.have.lengthOf(2);
      expect(result.result.metrics[0].country).to.equal('US');
      expect(result.result.metrics[1].country).to.equal('GB');
      expect(result.fullAuditRef).to.equal(`https://example.com/site-explorer/metrics-by-country?target=${target}&date=${date}`);
    });

    it('sends API request with custom date', async () => {
      const target = 'test-site.com';
      const customDate = '2025-11-10';

      nock(config.apiBaseUrl)
        .get('/site-explorer/metrics-by-country')
        .query({
          target,
          date: customDate,
        })
        .reply(200, metricsByCountryResponse);

      const result = await client.getMetricsByCountry(target, customDate);
      expect(result.result.metrics).to.have.lengthOf(2);
      expect(result.fullAuditRef).to.equal(`https://example.com/site-explorer/metrics-by-country?target=${target}&date=${customDate}`);
    });
  });

  describe('getLimitsAndUsage', () => {
    it('sends API request with appropriate endpoint', async () => {
      nock(config.apiBaseUrl)
        .get('/subscription-info/limits-and-usage')
        .reply(200, limitsUsageResponse);

      const result = await client.getLimitsAndUsage();
      expect(result).to.deep.equal({
        result: limitsUsageResponse,
        fullAuditRef: 'https://example.com/subscription-info/limits-and-usage',
      });
    });
  });
});
