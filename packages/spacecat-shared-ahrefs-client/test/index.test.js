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

import AhrefsAPIClient, { fetch } from '../src/index.js';

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
      },
      {
        keyword: 'keyword2',
        sum_traffic: 200,
        best_position_url: 'url2',
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
        .reply(400, 'Bad Request');

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
          select: [
            'keyword',
            'sum_traffic',
            'best_position_url',
          ].join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 200,
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

      const result = await client.getOrganicKeywords('test-site.com', 'us', ['keyword1', 'keyword2']);

      expect(result)
        .to
        .deep
        .equal({
          result: organicKeywordsResponse,
          fullAuditRef: 'https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=keyword%2Csum_traffic%2Cbest_position_url&order_by=sum_traffic%3Adesc&target=test-site.com&limit=200&mode=prefix&output=json&where=%7B%22or%22%3A%5B%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword1%22%5D%7D%2C%7B%22field%22%3A%22keyword%22%2C%22is%22%3A%5B%22iphrase_match%22%2C%22keyword2%22%5D%7D%5D%7D',
        });
    });

    it('sends API request with no keyword filter if none are specified', async () => {
      nock(config.apiBaseUrl)
        .get('/site-explorer/organic-keywords')
        .query({
          country: 'us',
          date: new Date().toISOString().split('T')[0],
          select: [
            'keyword',
            'sum_traffic',
            'best_position_url',
          ].join(','),
          order_by: 'sum_traffic:desc',
          target: 'test-site.com',
          limit: 200,
          mode: 'prefix',
          output: 'json',
        })
        .reply(200, organicKeywordsResponse);

      const result = await client.getOrganicKeywords('test-site.com');

      expect(result)
        .to
        .deep
        .equal({
          result: organicKeywordsResponse,
          fullAuditRef: 'https://example.com/site-explorer/organic-keywords?country=us&date=2023-03-12&select=keyword%2Csum_traffic%2Cbest_position_url&order_by=sum_traffic%3Adesc&target=test-site.com&limit=200&mode=prefix&output=json',
        });
    });

    it('throws error when keyword filter does not contain appropriate keyword items', async () => {
      const result = client.getOrganicKeywords('test-site.com', 'us', [BigInt(123)]);
      await expect(result).to.be.rejectedWith('Error parsing keyword filter: Do not know how to serialize a BigInt');
    });

    it('throws error when keyword filter is not an array', async () => {
      const result = client.getOrganicKeywords('test-site.com', 'us', 'keyword1');
      await expect(result).to.be.rejectedWith('Invalid keyword filter: keyword1');
    });

    it('throws error when url is not a string', async () => {
      const result = client.getOrganicKeywords(123);
      await expect(result).to.be.rejectedWith('Invalid URL: 123');
    });

    it('throws error when country is not a string', async () => {
      const result = client.getOrganicKeywords('test-site.com', 123);
      await expect(result).to.be.rejectedWith('Invalid country: 123');
    });

    it('throws error when limit is not an integer', async () => {
      const result = client.getOrganicKeywords('test-site.com', 'us', [], 1.5);
      await expect(result).to.be.rejectedWith('Invalid limit: 1.5');
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
