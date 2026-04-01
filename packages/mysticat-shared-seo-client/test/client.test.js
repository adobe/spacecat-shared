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
import nock from 'nock';
import sinon from 'sinon';

import SeoClient, { fetch, ORGANIC_KEYWORDS_FIELDS, METRICS_BY_COUNTRY_FILTER_FIELDS } from '../src/index.js';

use(chaiAsPromised);
const sandbox = sinon.createSandbox();

const mockDate = '2025-03-12T15:24:51.231Z';

describe('SeoClient', () => {
  let client;

  const config = {
    apiKey: 'testApiKey',
    apiBaseUrl: 'https://seo-api.example.com',
  };

  // --- Real API response fixtures (from adobe.com, March 2025) ---

  const metricsCsv = [
    'Organic Keywords;Adwords Keywords;Organic Traffic;Organic Cost;Adwords Traffic;Adwords Cost;X0',
    '"8669522";"38372";"41042165";"102460201";"1231861";"6811855";"851962"',
  ].join('\n');

  const organicTrafficCsv = [
    'Date;Organic Traffic;Organic Cost;Adwords Traffic;Adwords Cost',
    '"20241015";"46426259";"97859337";"1160932";"6093531"',
    '"20241115";"48707244";"104420586";"1327984";"6459400"',
    '"20241215";"46565921";"100697987";"1692161";"9932479"',
    '"20250115";"48115239";"104687762";"1645789";"9147264"',
    '"20250215";"42197498";"105349009";"1601733";"8346197"',
  ].join('\n');

  const topPagesCsv = [
    'Url;Traffic',
    '"https://www.adobe.com/";"1035443"',
    '"https://get.adobe.com/reader/";"849245"',
    '"https://www.adobe.com/products/firefly/features/text-to-image.html";"548150"',
  ].join('\n');

  const topPagesKeywordsCsv = [
    'Url;Keyword;Traffic',
    '"https://www.adobe.com/";"adobe";"800000"',
    '"https://www.adobe.com/express/";"adobe express";"360000"',
    '"https://www.adobe.com/express/feature/image/remove-background";"background remover";"248000"',
    '"https://www.adobe.com/products/firefly/features/text-to-image.html";"ai image generator";"204104"',
    '"https://get.adobe.com/reader/";"adobe reader";"132000"',
  ].join('\n');

  const organicKeywordsCsv = [
    'Keyword;Position;Previous Position;Search Volume;CPC;Url;Traffic;Traffic (%);Keyword Difficulty;SERP Features by Position;SERP Features by Keyword;Timestamp;Intents',
    '"adobe";"1";"1";"1000000";"6.35";"https://www.adobe.com/";"800000";"1.69";"90.00";"6";"5,6,9,14,36,37";"1774673831";"2"',
    '"adobe express";"1";"1";"450000";"1.88";"https://www.adobe.com/express/";"360000";"0.76";"68.00";"6";"1,6,9,14,15,20,36";"1774728124";"2"',
    '"background remover";"1";"1";"1000000";"0.40";"https://www.adobe.com/express/feature/image/remove-background";"248000";"0.52";"100.00";"";"5,9,36";"1774705746";"1"',
    '".";"1";"1";"1830000";"0.00";"https://www.adobe.com/acrobat/resources/full-stop-punctuation.html";"241560";"0.51";"48.00";"";"5,9,13,52";"1774573442";"1"',
    '"adobe acrobat";"1";"1";"301000";"2.12";"https://www.adobe.com/acrobat.html";"240800";"0.51";"89.00";"";"6,9,14,15,20,36,37,43";"1774642054";"2"',
  ].join('\n');

  const paidKeywordsCsv = [
    'Keyword;Url;Traffic;Search Volume;CPC;Position;Title',
    '"adobe";"https://www.adobe.com/creativecloud/adobe/campaign/pricing.html";"47000";"1000000";"6.43";"1";"Adobe® - Official Site"',
    '"adobe stock";"https://stock.adobe.com/promo/firstmonthfree";"25850";"550000";"0.79";"1";"Adobe Stock Images"',
    '"adobe express";"https://www.adobe.com/express/";"17296";"368000";"13.27";"1";"Adobe Express"',
    '"photoshop";"https://www.adobe.com/products/photoshop/landpa.html";"14147";"301000";"26.63";"1";"Adobe Photoshop"',
    '"adobe";"https://www.adobe.com/creativecloud/adobe/campaign/pricing.html";"13000";"1000000";"6.43";"2";"Adobe® - Official Site"',
    '"adobe acrobat";"https://www.adobe.com/acrobat/complete-pdf-solution.html";"11562";"246000";"1.76";"1";"Adobe Acrobat Pro"',
    '"pdf editor";"https://www.adobe.com/acrobat/complete-pdf-solution.html";"11562";"246000";"2.01";"1";"Adobe Acrobat PDF Editor"',
  ].join('\n');

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
    client = new SeoClient(config, fetch);
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  // ===== Constructor & Factory =====

  describe('constructor', () => {
    it('throws error when api base url is missing', () => {
      expect(() => new SeoClient({})).to.throw('Invalid SEO API Base URL: undefined');
    });

    it('throws error when api base url is invalid', () => {
      expect(() => new SeoClient({ apiBaseUrl: 'not-a-url', apiKey: 'key' }, () => {}))
        .to.throw('Invalid SEO API Base URL');
    });

    it('throws error when api key is missing', () => {
      expect(() => new SeoClient({ apiBaseUrl: config.apiBaseUrl }, () => {}))
        .to.throw('Missing SEO API key');
    });

    it('throws error when fetch is not a function', () => {
      expect(() => new SeoClient(config, 'fetch')).to.throw('"fetchAPI" must be a function');
    });

    it('stores config and defaults log to console', () => {
      const c = new SeoClient(config, fetch);
      expect(c.apiBaseUrl).to.equal(config.apiBaseUrl);
      expect(c.apiKey).to.equal(config.apiKey);
      expect(c.log).to.equal(console);
    });
  });

  describe('createFrom', () => {
    it('creates an instance of SeoClient', () => {
      const context = {
        env: {
          SEO_API_BASE_URL: 'https://seo-api.example.com',
          SEO_API_KEY: 'testApiKey',
        },
      };

      const seoClient = SeoClient.createFrom(context);
      expect(seoClient).to.be.instanceOf(SeoClient);
    });

    it('throws when SEO_API_BASE_URL is missing', () => {
      const context = { env: { SEO_API_KEY: 'key' } };
      expect(() => SeoClient.createFrom(context)).to.throw('Invalid SEO API Base URL');
    });
  });

  // ===== sendRequest (public, backward-compatible) =====

  describe('sendRequest', () => {
    it('accepts (endpoint, queryParams) signature and returns parsed result', async () => {
      nock(config.apiBaseUrl)
        .get('/some-endpoint')
        .query(true)
        .reply(200, 'Header1;Header2\nval1;val2');

      const result = await client.sendRequest('/some-endpoint', { foo: 'bar' });
      expect(result.result).to.deep.equal({ Header1: 'val1', Header2: 'val2' });
      expect(result.fullAuditRef).to.include('key=REDACTED');
      expect(result.fullAuditRef).to.not.include('testApiKey');
    });

    it('returns array when CSV has multiple rows', async () => {
      nock(config.apiBaseUrl)
        .get('/test')
        .query(true)
        .reply(200, 'A;B\n1;2\n3;4');

      const result = await client.sendRequest('/test');
      expect(result.result).to.deep.equal([
        { A: '1', B: '2' },
        { A: '3', B: '4' },
      ]);
    });

    it('returns single object when CSV has one row', async () => {
      nock(config.apiBaseUrl)
        .get('/test')
        .query(true)
        .reply(200, 'A;B\n1;2');

      const result = await client.sendRequest('/test');
      expect(result.result).to.deep.equal({ A: '1', B: '2' });
    });

    it('returns empty array when CSV has header only', async () => {
      nock(config.apiBaseUrl)
        .get('/test')
        .query(true)
        .reply(200, 'A;B');

      const result = await client.sendRequest('/test');
      expect(result.result).to.deep.equal([]);
    });
  });

  // ===== sendRawRequest (internal transport) =====

  describe('sendRawRequest', () => {
    it('returns raw body and fullAuditRef on success', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query(true)
        .reply(200, 'Header1;Header2\nval1;val2');

      const result = await client.sendRawRequest({ type: 'test_type' });
      expect(result.body).to.equal('Header1;Header2\nval1;val2');
      expect(result.fullAuditRef).to.include('type=test_type');
      expect(result.fullAuditRef).to.include('key=REDACTED');
    });

    it('appends apiPath to the URL when provided', async () => {
      nock(config.apiBaseUrl)
        .get('/analytics/v1/')
        .query(true)
        .reply(200, 'H\nV');

      const result = await client.sendRawRequest({ type: 'test' }, 'analytics/v1/');
      expect(result.fullAuditRef).to.include('/analytics/v1/');
    });

    it('throws error when API returns ERROR body', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query(true)
        .reply(200, 'ERROR 30 :: LIMIT EXCEEDED');

      await expect(client.sendRawRequest({ type: 'test_type' }))
        .to.be.rejectedWith('SEO API request failed: ERROR 30 :: LIMIT EXCEEDED');
    });

    it('throws error when API returns ERROR 132 (no units)', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query(true)
        .reply(200, 'ERROR 132 :: API UNITS BALANCE IS ZERO');

      await expect(client.sendRawRequest({ type: 'test_type' }))
        .to.be.rejectedWith('SEO API request failed: ERROR 132 :: API UNITS BALANCE IS ZERO');
    });

    it('throws error when HTTP status is not ok', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query(true)
        .reply(500, 'Internal Server Error');

      await expect(client.sendRawRequest({ type: 'test_type' }))
        .to.be.rejectedWith('SEO API request failed with status: 500 - Internal Server Error');
    });

    it('handles request without type param', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query(true)
        .reply(200, 'H\nV');

      const result = await client.sendRawRequest({});
      expect(result.body).to.equal('H\nV');
    });
  });

  // ===== getMetrics =====

  describe('getMetrics', () => {
    it('returns adobe.com metrics with correct field mapping and currency conversion', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank')
        .reply(200, metricsCsv);

      const result = await client.getMetrics('adobe.com', '2025-03-01');
      expect(result.result).to.deep.equal({
        metrics: {
          org_keywords: 8669522,
          paid_keywords: 38372,
          org_keywords_1_3: 851962,
          org_traffic: 41042165,
          org_cost: 10246020100, // 102460201 * 100
          paid_traffic: 1231861,
          paid_cost: 681185500, // 6811855 * 100
          paid_pages: null,
        },
      });
      expect(result.fullAuditRef).to.include('type=domain_rank');
      expect(result.fullAuditRef).to.include('domain=adobe.com');
      expect(result.fullAuditRef).to.include('display_date=20250315');
    });

    it('throws error when url is not a string', async () => {
      await expect(client.getMetrics(null)).to.be.rejectedWith('Invalid URL');
    });

    it('uses today as default date', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank' && q.display_date === '20250315')
        .reply(200, metricsCsv);

      await client.getMetrics('adobe.com');
    });

    it('handles empty CSV response', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank')
        .reply(200, 'Organic Keywords;Adwords Keywords;Organic Traffic;Organic Cost;Adwords Traffic;Adwords Cost;X0');

      const result = await client.getMetrics('adobe.com');
      expect(result.result.metrics.org_keywords).to.equal(null);
      expect(result.result.metrics.org_cost).to.equal(0);
      expect(result.result.metrics.paid_cost).to.equal(0);
    });
  });

  // ===== getOrganicTraffic =====

  describe('getOrganicTraffic', () => {
    it('returns filtered adobe.com historical metrics with currency conversion', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank_history')
        .reply(200, organicTrafficCsv);

      const result = await client.getOrganicTraffic('adobe.com', '2024-11-01', '2025-01-31');

      expect(result.result.metrics).to.have.lengthOf(3);
      expect(result.result.metrics[0]).to.deep.equal({
        date: '2024-11-15T00:00:00Z',
        org_traffic: 48707244,
        paid_traffic: 1327984,
        org_cost: 10442058600,
        paid_cost: 645940000,
      });
      expect(result.result.metrics[2]).to.deep.equal({
        date: '2025-01-15T00:00:00Z',
        org_traffic: 48115239,
        paid_traffic: 1645789,
        org_cost: 10468776200,
        paid_cost: 914726400,
      });
    });

    it('filters out data points outside the date range', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank_history')
        .reply(200, organicTrafficCsv);

      const result = await client.getOrganicTraffic('adobe.com', '2025-02-01', '2025-02-28');
      expect(result.result.metrics).to.have.lengthOf(1);
      expect(result.result.metrics[0].date).to.equal('2025-02-15T00:00:00Z');
      expect(result.result.metrics[0].org_traffic).to.equal(42197498);
    });

    it('handles null cost values', async () => {
      const csv = 'Date;Organic Traffic;Organic Cost;Adwords Traffic;Adwords Cost\n"20250115";"100";"";"50";""';
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank_history')
        .reply(200, csv);

      const result = await client.getOrganicTraffic('adobe.com', '2025-01-01', '2025-02-01');
      expect(result.result.metrics[0].org_cost).to.equal(0);
      expect(result.result.metrics[0].paid_cost).to.equal(0);
    });

    it('throws error when url is not a string', async () => {
      await expect(client.getOrganicTraffic(null, '2024-01-01', '2024-12-31'))
        .to.be.rejectedWith('Invalid URL');
    });

    it('returns empty array when no dates in range', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank_history')
        .reply(200, organicTrafficCsv);

      const result = await client.getOrganicTraffic('adobe.com', '2030-01-01', '2030-12-31');
      expect(result.result.metrics).to.deep.equal([]);
    });

    it('includes fullAuditRef with correct type and domain', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_rank_history')
        .reply(200, organicTrafficCsv);

      const result = await client.getOrganicTraffic('adobe.com', '2024-01-01', '2025-12-31');
      expect(result.fullAuditRef).to.include('type=domain_rank_history');
      expect(result.fullAuditRef).to.include('domain=adobe.com');
    });
  });

  // ===== getTopPages =====

  describe('getTopPages', () => {
    it('returns adobe.com pages with top keywords from two API calls', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic_unique')
        .reply(200, topPagesCsv);

      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.export_columns === 'Ur,Ph,Tg')
        .reply(200, topPagesKeywordsCsv);

      const result = await client.getTopPages('adobe.com', 3);

      expect(result.result.pages).to.have.lengthOf(3);
      expect(result.result.pages[0]).to.deep.equal({
        url: 'https://www.adobe.com/',
        sum_traffic: 1035443,
        top_keyword: 'adobe',
      });
      expect(result.result.pages[1]).to.deep.equal({
        url: 'https://get.adobe.com/reader/',
        sum_traffic: 849245,
        top_keyword: 'adobe reader',
      });
      expect(result.result.pages[2]).to.deep.equal({
        url: 'https://www.adobe.com/products/firefly/features/text-to-image.html',
        sum_traffic: 548150,
        top_keyword: 'ai image generator',
      });
    });

    it('returns null for top_keyword when no keyword data found', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic_unique')
        .reply(200, 'Url;Traffic\n"https://unknown.com/page";"50"');

      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.export_columns === 'Ur,Ph,Tg')
        .reply(200, 'Url;Keyword;Traffic');

      const result = await client.getTopPages('unknown.com');
      expect(result.result.pages[0].top_keyword).to.equal(null);
    });

    it('throws error when url is not a string', async () => {
      await expect(client.getTopPages(null)).to.be.rejectedWith('Invalid URL');
    });

    it('respects upper limit of 2000', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic_unique' && q.display_limit === '2000')
        .reply(200, topPagesCsv);

      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.export_columns === 'Ur,Ph,Tg')
        .reply(200, topPagesKeywordsCsv);

      await client.getTopPages('adobe.com', 5000);
    });
  });

  // ===== getOrganicKeywords =====

  describe('getOrganicKeywords', () => {
    it('returns adobe.com keywords with intent mapping, brand detection, and currency conversion', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.database === 'us')
        .reply(200, organicKeywordsCsv);

      const result = await client.getOrganicKeywords('adobe.com', {
        country: 'us',
        limit: 5,
      });

      expect(result.result.keywords).to.have.lengthOf(5);

      // "adobe" — branded (contains "adobe"), navigational intent
      const kw1 = result.result.keywords[0];
      expect(kw1.keyword).to.equal('adobe');
      expect(kw1.keyword_country).to.equal('us');
      expect(kw1.language).to.equal(null);
      expect(kw1.sum_traffic).to.equal(800000);
      expect(kw1.volume).to.equal(1000000);
      expect(kw1.best_position).to.equal(1);
      expect(kw1.best_position_url).to.equal('https://www.adobe.com/');
      expect(kw1.cpc).to.equal(635); // 6.35 * 100
      expect(kw1.last_update).to.be.a('string').that.includes('T');
      expect(kw1.is_branded).to.equal(true);
      expect(kw1.is_navigational).to.equal(true); // In=2
      expect(kw1.is_informational).to.equal(false);
      expect(kw1.is_commercial).to.equal(false);
      expect(kw1.is_transactional).to.equal(false);
      expect(kw1.serp_features).to.equal('6');

      // "background remover" — not branded, informational intent
      const kw3 = result.result.keywords[2];
      expect(kw3.keyword).to.equal('background remover');
      expect(kw3.is_branded).to.equal(false);
      expect(kw3.is_informational).to.equal(true); // In=1
      expect(kw3.is_navigational).to.equal(false);
      expect(kw3.cpc).to.equal(40); // 0.40 * 100
      expect(kw3.serp_features).to.equal(null); // empty Fp

      // "." — not branded, informational
      const kw4 = result.result.keywords[3];
      expect(kw4.keyword).to.equal('.');
      expect(kw4.is_branded).to.equal(false);
      expect(kw4.cpc).to.equal(0); // 0.00 * 100
    });

    it('filters out branded keywords when excludeBranded is true', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic')
        .reply(200, organicKeywordsCsv);

      const result = await client.getOrganicKeywords('adobe.com', {
        country: 'us',
        limit: 10,
        excludeBranded: true,
      });

      // "adobe", "adobe express", "adobe acrobat" contain "adobe" → filtered out
      const keywords = result.result.keywords.map((kw) => kw.keyword);
      expect(keywords).to.not.include('adobe');
      expect(keywords).to.not.include('adobe express');
      expect(keywords).to.not.include('adobe acrobat');
      expect(keywords).to.include('background remover');
      expect(keywords).to.include('.');
    });

    it('sends keyword filter as display_filter', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic'
          && q.display_filter === '+|Ph|Co|photoshop|+|Ph|Co|illustrator')
        .reply(200, organicKeywordsCsv);

      await client.getOrganicKeywords('adobe.com', {
        country: 'us',
        keywordFilter: ['photoshop', 'illustrator'],
        limit: 10,
      });
    });

    it('sends no display_filter when keywordFilter is empty', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && !q.display_filter)
        .reply(200, organicKeywordsCsv);

      await client.getOrganicKeywords('adobe.com');
    });

    it('respects upper limit of 100', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.display_limit === '100')
        .reply(200, organicKeywordsCsv);

      await client.getOrganicKeywords('adobe.com', { limit: 5000 });
    });

    it('over-fetches when excludeBranded is true', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic' && q.display_limit === '30')
        .reply(200, organicKeywordsCsv);

      await client.getOrganicKeywords('adobe.com', { limit: 10, excludeBranded: true });
    });

    it('combines keyword filters and excludeBranded', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic'
          && q.display_filter === '+|Ph|Co|remover')
        .reply(200, organicKeywordsCsv);

      const result = await client.getOrganicKeywords('adobe.com', {
        country: 'us',
        keywordFilter: ['remover'],
        excludeBranded: true,
      });

      result.result.keywords.forEach((kw) => {
        expect(kw.is_branded).to.equal(false);
      });
    });

    it('handles missing Ph field for brand detection', async () => {
      const csv = 'Keyword;Position;Search Volume;CPC;Url;Traffic;Intents\n;1;100;0.10;url1;50;\n';
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic')
        .reply(200, csv);

      const result = await client.getOrganicKeywords('adobe.com');
      expect(result.result.keywords[0].is_branded).to.equal(false);
    });

    it('treats all keywords as non-branded for single-char domains', async () => {
      const csv = 'Keyword;Position;Search Volume;CPC;Url;Traffic;Intents\na keyword;1;100;0.10;url1;50;\n';
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic')
        .reply(200, csv);

      const result = await client.getOrganicKeywords('x.com');
      expect(result.result.keywords[0].is_branded).to.equal(false);
    });

    it('handles missing In, Ts, Fp, and Cp fields', async () => {
      const csv = 'Keyword;Position;Search Volume;CPC;Url;Traffic;Intents\nkw1;5;1000;;url1;50;\n';
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_organic')
        .reply(200, csv);

      const result = await client.getOrganicKeywords('test-site.com');
      const kw = result.result.keywords[0];
      expect(kw.cpc).to.equal(0);
      expect(kw.last_update).to.equal(null);
      expect(kw.serp_features).to.equal(null);
      expect(kw.is_commercial).to.equal(false);
      expect(kw.is_informational).to.equal(false);
      expect(kw.is_navigational).to.equal(false);
      expect(kw.is_transactional).to.equal(false);
    });

    it('throws error when keyword filter is not an array', async () => {
      await expect(client.getOrganicKeywords('adobe.com', { country: 'us', keywordFilter: 'keyword1' }))
        .to.be.rejectedWith('Invalid keyword filter: keyword1');
    });

    it('throws error when url is not a string', async () => {
      await expect(client.getOrganicKeywords(123))
        .to.be.rejectedWith('Invalid URL: 123');
    });

    it('throws error when country is not a string', async () => {
      await expect(client.getOrganicKeywords('adobe.com', { country: 123 }))
        .to.be.rejectedWith('Invalid country: 123');
    });

    it('throws error when limit is not an integer', async () => {
      await expect(client.getOrganicKeywords('adobe.com', { country: 'us', keywordFilter: [], limit: 1.5 }))
        .to.be.rejectedWith('Invalid limit: 1.5');
    });

    it('throws error when mode is invalid', async () => {
      await expect(client.getOrganicKeywords('adobe.com', {
        country: 'us', keywordFilter: [], limit: 200, mode: 'invalid-mode',
      })).to.be.rejectedWith('Invalid mode: invalid-mode');
    });
  });

  // ===== getPaidPages =====

  describe('getPaidPages', () => {
    it('throws error when url is not a string', async () => {
      await expect(client.getPaidPages(null)).to.be.rejectedWith('Invalid URL');
    });

    it('aggregates adobe.com paid keywords into page-level data', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_adwords')
        .reply(200, paidKeywordsCsv);

      const result = await client.getPaidPages('adobe.com', '2025-03-01', 5);

      // 7 keywords across 6 unique URLs (pricing page has 2 keywords)
      expect(result.result.pages).to.have.lengthOf(5);

      // Page with most traffic: pricing page (47000+13000=60000 from two "adobe" keywords)
      const topPage = result.result.pages[0];
      expect(topPage.url).to.equal('https://www.adobe.com/creativecloud/adobe/campaign/pricing.html');
      expect(topPage.sum_traffic).to.equal(60000);
      expect(topPage.top_keyword).to.equal('adobe'); // 47000 > 13000
      expect(topPage.top_keyword_best_position_title).to.equal('Adobe® - Official Site');
      expect(topPage.top_keyword_country).to.equal('US');
      expect(topPage.top_keyword_volume).to.equal(1000000);

      // Adobe Stock page (single keyword)
      const stockPage = result.result.pages[1];
      expect(stockPage.url).to.equal('https://stock.adobe.com/promo/firstmonthfree');
      expect(stockPage.sum_traffic).to.equal(25850);
      expect(stockPage.top_keyword).to.equal('adobe stock');

      // Acrobat page (two keywords: "adobe acrobat" 11562 + "pdf editor" 11562)
      const acrobatPage = result.result.pages.find(
        (p) => p.url === 'https://www.adobe.com/acrobat/complete-pdf-solution.html',
      );
      expect(acrobatPage.sum_traffic).to.equal(23124);
    });

    it('sends custom date converted to API format', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_adwords' && q.display_date === '20251115')
        .reply(200, paidKeywordsCsv);

      await client.getPaidPages('adobe.com', '2025-11-10', 500);
    });

    it('respects upper limit of 1000 on output', async () => {
      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_adwords')
        .reply(200, paidKeywordsCsv);

      const result = await client.getPaidPages('adobe.com', undefined, 5000);
      expect(result.result.pages.length).to.be.at.most(1000);
    });

    it('handles keywords with zero/null traffic and CPC', async () => {
      const csv = [
        'Keyword;Url;Traffic;Search Volume;CPC;Position;Title',
        '"kw1";"https://example.com/p";"0";"100";"";"3";""',
        '"kw2";"https://example.com/p";"";"200";"0.50";"5";"Title"',
      ].join('\n');

      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_adwords')
        .reply(200, csv);

      const result = await client.getPaidPages('example.com');
      const page = result.result.pages[0];
      expect(page.sum_traffic).to.equal(0);
      expect(page.top_keyword_best_position_title).to.equal(null);
      expect(page.value).to.equal(0);
    });

    it('picks the keyword with the most traffic as top_keyword', async () => {
      const csv = [
        'Keyword;Url;Traffic;Search Volume;CPC;Position;Title',
        '"low-kw";"https://example.com/p";"10";"100";"0.50";"5";"Low Title"',
        '"high-kw";"https://example.com/p";"500";"200";"1.00";"1";"High Title"',
      ].join('\n');

      nock(config.apiBaseUrl)
        .get('/')
        .query((q) => q.type === 'domain_adwords')
        .reply(200, csv);

      const result = await client.getPaidPages('example.com');
      expect(result.result.pages[0].top_keyword).to.equal('high-kw');
      expect(result.result.pages[0].top_keyword_best_position_title).to.equal('High Title');
    });
  });

  // ===== getBrokenBacklinks (stub — pending API clarification) =====

  describe('getBrokenBacklinks', () => {
    it('returns stub response', async () => {
      const result = await client.getBrokenBacklinks('target.com');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });
  });

  // ===== Stub methods (out of scope) =====

  describe('stub methods', () => {
    it('getBacklinks returns stub response', async () => {
      const result = await client.getBacklinks('https://example.com', 200);
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });

    it('getMetricsByCountry returns stub response', async () => {
      const result = await client.getMetricsByCountry('https://example.com', '2025-01-01');
      expect(result).to.deep.equal({ result: {}, fullAuditRef: '' });
    });
  });

  // ===== Index exports =====

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

    it('exports utility functions', () => {
      expect(indexModule.buildQueryParams).to.be.a('function');
      expect(indexModule.parseCsvResponse).to.be.a('function');
      expect(indexModule.coerceValue).to.be.a('function');
      expect(indexModule.getLimit).to.be.a('function');
      expect(indexModule.toApiDate).to.be.a('function');
      expect(indexModule.fromApiDate).to.be.a('function');
      expect(indexModule.todayISO).to.be.a('function');
      expect(indexModule.buildFilter).to.be.a('function');
      expect(indexModule.extractBrand).to.be.a('function');
    });

    it('exports INTENT_CODES', () => {
      expect(indexModule.INTENT_CODES).to.be.an('object');
      expect(indexModule.INTENT_CODES.COMMERCIAL).to.equal(0);
    });

    it('exports parseResponse for backward compatibility', () => {
      expect(indexModule.parseResponse).to.be.a('function');
      expect(indexModule.parseResponse({ test: 1 })).to.deep.equal({ test: 1 });
    });

    it('exports ORGANIC_KEYWORDS_FIELDS with 15 entries', () => {
      expect(ORGANIC_KEYWORDS_FIELDS).to.be.an('array').with.lengthOf(15);
      expect(ORGANIC_KEYWORDS_FIELDS).to.include('keyword');
      expect(ORGANIC_KEYWORDS_FIELDS).to.include('is_branded');
      expect(ORGANIC_KEYWORDS_FIELDS).to.include('serp_features');
    });

    it('exports METRICS_BY_COUNTRY_FILTER_FIELDS with 8 entries', () => {
      expect(METRICS_BY_COUNTRY_FILTER_FIELDS).to.be.an('array').with.lengthOf(8);
      expect(METRICS_BY_COUNTRY_FILTER_FIELDS).to.include('org_keywords');
      expect(METRICS_BY_COUNTRY_FILTER_FIELDS).to.include('paid_pages');
    });
  });
});
