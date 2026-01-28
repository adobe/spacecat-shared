/*
 * Copyright 2025 Adobe. All rights reserved.
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

import { expect } from 'chai';
import {
  getTrafficAnalysisQuery,
  getTrafficAnalysisQueryPlaceholders,
  buildPageTypeCase,
  getTrafficAnalysisQueryPlaceholdersFilled,
  getTop3PagesWithTrafficLostTemplate,
  getTrafficTypeAnalysisTemplate,
} from '../src/traffic-analysis/queries.js';

describe('Traffic Analysis Queries', () => {
  describe('getTrafficAnalysisQuery', () => {
    it('should generate traffic analysis query with placeholders', () => {
      const placeholders = {
        siteId: 'test-site-123',
        tableName: 'traffic_table',
        temporalCondition: 'year=2024 AND week=45',
        dimensionColumns: 'path, device',
        groupBy: 'path, device',
        dimensionColumnsPrefixed: 'a.path, a.device',
        pageTypeCase: 'NULL as page_type',
        trfTypeCondition: 'TRUE',
        pageViewThreshold: 1000,
      };

      const result = getTrafficAnalysisQuery(placeholders);

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
      expect(result).to.include('test-site-123');
      expect(result).to.include('traffic_table');
      expect(result).to.include('year=2024 AND week=45');
    });

    it('should work with empty placeholders', () => {
      const result = getTrafficAnalysisQuery({});

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });

    it('should work without parameters', () => {
      const result = getTrafficAnalysisQuery();

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });

  describe('getTrafficAnalysisQueryPlaceholders', () => {
    it('should return array of placeholder keys', () => {
      const result = getTrafficAnalysisQueryPlaceholders();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(9);
      expect(result).to.include('dimensionColumns');
      expect(result).to.include('dimensionColumnsPrefixed');
      expect(result).to.include('groupBy');
      expect(result).to.include('pageTypeCase');
      expect(result).to.include('pageViewThreshold');
      expect(result).to.include('siteId');
      expect(result).to.include('tableName');
      expect(result).to.include('temporalCondition');
      expect(result).to.include('trfTypeCondition');
    });
  });

  describe('buildPageTypeCase', () => {
    it('should build CASE statement with multiple page types', () => {
      const pageTypes = [
        { name: 'Product Pages', pattern: '^/products/.*' },
        { name: 'Blog Posts', pattern: '^/blog/.*' },
        { name: 'Home Page', pattern: '^/$' },
      ];

      const result = buildPageTypeCase(pageTypes, 'path');

      expect(result).to.be.a('string');
      expect(result).to.include('CASE');
      expect(result).to.include('END AS page_type');
      expect(result).to.include("WHEN REGEXP_LIKE(path, '^/products/.*') THEN 'Product Pages'");
      expect(result).to.include("WHEN REGEXP_LIKE(path, '^/blog/.*') THEN 'Blog Posts'");
      expect(result).to.include("WHEN REGEXP_LIKE(path, '^/$') THEN 'Home Page'");
      expect(result).to.include("ELSE 'other | Other Pages'");
    });

    it('should handle single page type', () => {
      const pageTypes = [
        { name: 'Product', pattern: '^/product' },
      ];

      const result = buildPageTypeCase(pageTypes, 'url');

      expect(result).to.include('CASE');
      expect(result).to.include("WHEN REGEXP_LIKE(url, '^/product') THEN 'Product'");
      expect(result).to.include("ELSE 'other | Other Pages'");
      expect(result).to.include('END AS page_type');
    });

    it('should escape single quotes in page type names', () => {
      const pageTypes = [
        { name: "Women's Products", pattern: '^/womens/.*' },
      ];

      const result = buildPageTypeCase(pageTypes, 'path');

      expect(result).to.include("THEN 'Women''s Products'");
    });

    it('should handle different column names', () => {
      const pageTypes = [
        { name: 'Landing', pattern: '^/landing' },
      ];

      const result = buildPageTypeCase(pageTypes, 'custom_column');

      expect(result).to.include('WHEN REGEXP_LIKE(custom_column,');
    });

    it('should return null when pageTypes is null', () => {
      const result = buildPageTypeCase(null, 'path');

      expect(result).to.be.null;
    });

    it('should return null when pageTypes is undefined', () => {
      const result = buildPageTypeCase(undefined, 'path');

      expect(result).to.be.null;
    });

    it('should return null when pageTypes is empty array', () => {
      const result = buildPageTypeCase([], 'path');

      expect(result).to.be.null;
    });
  });

  describe('getTrafficAnalysisQueryPlaceholdersFilled', () => {
    it('should fill placeholders with week-based parameters', () => {
      const params = {
        week: 45,
        year: 2024,
        siteId: 'test-site-123',
        dimensions: ['path', 'device'],
        tableName: 'traffic_table',
        pageViewThreshold: 1000,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result).to.be.an('object');
      expect(result.siteId).to.equal('test-site-123');
      expect(result.tableName).to.equal('traffic_table');
      expect(result.groupBy).to.equal('path, device');
      expect(result.dimensionColumns).to.equal('path, device');
      expect(result.dimensionColumnsPrefixed).to.equal('a.path, a.device');
      expect(result.pageViewThreshold).to.equal(1000);
      expect(result.temporalCondition).to.include('year=2024');
      expect(result.temporalCondition).to.include('week=45');
      expect(result.pageTypeCase).to.equal('NULL as page_type');
      expect(result.trfTypeCondition).to.equal('TRUE');
    });

    it('should fill placeholders with month-based parameters', () => {
      const params = {
        month: 3,
        year: 2024,
        siteId: 'test-site-456',
        dimensions: ['utm_campaign'],
        tableName: 'monthly_table',
        pageViewThreshold: 500,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.siteId).to.equal('test-site-456');
      expect(result.tableName).to.equal('monthly_table');
      expect(result.groupBy).to.equal('utm_campaign');
      expect(result.dimensionColumns).to.equal('utm_campaign');
      expect(result.dimensionColumnsPrefixed).to.equal('a.utm_campaign');
      expect(result.pageViewThreshold).to.equal(500);
      expect(result.temporalCondition).to.include('year=2024');
      expect(result.temporalCondition).to.include('month=3');
    });

    it('should handle empty dimensions', () => {
      const params = {
        week: 10,
        year: 2024,
        siteId: 'empty-dims-site',
        dimensions: [],
        tableName: 'test_table',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.equal('');
      expect(result.dimensionColumns).to.equal('');
      expect(result.dimensionColumnsPrefixed).to.equal('');
    });

    it('should handle missing dimensions parameter', () => {
      const params = {
        week: 10,
        year: 2024,
        siteId: 'no-dims-site',
        tableName: 'test_table',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.equal('');
      expect(result.dimensionColumns).to.equal('');
      expect(result.dimensionColumnsPrefixed).to.equal('');
    });

    it('should build page type CASE when page_type dimension is included', () => {
      const params = {
        week: 15,
        year: 2024,
        siteId: 'page-type-site',
        dimensions: ['path', 'page_type'],
        tableName: 'page_table',
        pageTypes: [
          { name: 'Product', pattern: '^/products/.*' },
          { name: 'Blog', pattern: '^/blog/.*' },
        ],
        pageTypeMatchColumn: 'path',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.include('CASE');
      expect(result.pageTypeCase).to.include('WHEN REGEXP_LIKE(path,');
      expect(result.pageTypeCase).to.include('Product');
      expect(result.pageTypeCase).to.include('Blog');
    });

    it('should use custom pageTypeMatchColumn', () => {
      const params = {
        week: 15,
        year: 2024,
        siteId: 'custom-col-site',
        dimensions: ['page_type'],
        tableName: 'custom_table',
        pageTypes: [
          { name: 'Landing', pattern: '^/landing' },
        ],
        pageTypeMatchColumn: 'url',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.include('WHEN REGEXP_LIKE(url,');
    });

    it('should not build page type CASE when pageTypes is null', () => {
      const params = {
        week: 15,
        year: 2024,
        siteId: 'null-page-types',
        dimensions: ['path', 'page_type'],
        tableName: 'test_table',
        pageTypes: null,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.equal('NULL as page_type');
    });

    it('should not build page type CASE when page_type dimension is not included', () => {
      const params = {
        week: 15,
        year: 2024,
        siteId: 'no-page-type-dim',
        dimensions: ['path', 'device'],
        tableName: 'test_table',
        pageTypes: [
          { name: 'Product', pattern: '^/products/.*' },
        ],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.equal('NULL as page_type');
    });

    it('should build traffic type condition with single type', () => {
      const params = {
        week: 20,
        year: 2024,
        siteId: 'single-trf-site',
        dimensions: ['path'],
        tableName: 'trf_table',
        trfTypes: ['paid'],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.trfTypeCondition).to.equal("trf_type IN ('paid')");
    });

    it('should build traffic type condition with multiple types', () => {
      const params = {
        week: 20,
        year: 2024,
        siteId: 'multi-trf-site',
        dimensions: ['path'],
        tableName: 'trf_table',
        trfTypes: ['paid', 'organic', 'direct'],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.trfTypeCondition).to.equal("trf_type IN ('paid', 'organic', 'direct')");
    });

    it('should use TRUE condition when trfTypes is null', () => {
      const params = {
        week: 20,
        year: 2024,
        siteId: 'null-trf-site',
        dimensions: ['path'],
        tableName: 'trf_table',
        trfTypes: null,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.trfTypeCondition).to.equal('TRUE');
    });

    it('should use TRUE condition when trfTypes is empty array', () => {
      const params = {
        week: 20,
        year: 2024,
        siteId: 'empty-trf-site',
        dimensions: ['path'],
        tableName: 'trf_table',
        trfTypes: [],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.trfTypeCondition).to.equal('TRUE');
    });

    it('should use custom temporalCondition when provided', () => {
      const params = {
        siteId: 'custom-temp-site',
        dimensions: ['path'],
        tableName: 'custom_table',
        temporalCondition: 'year=2023 AND week BETWEEN 10 AND 15',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      // temporalCondition should be null since it was provided
      expect(result.temporalCondition).to.be.null;
    });

    it('should add week dimension when numTemporalSeries > 1 and week is provided', () => {
      const params = {
        week: 45,
        year: 2024,
        siteId: 'multi-week-site',
        dimensions: ['path'],
        tableName: 'multi_table',
        numTemporalSeries: 3,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.include('week');
      expect(result.dimensionColumns).to.include('week');
      expect(result.dimensionColumnsPrefixed).to.include('a.week');
    });

    it('should add month dimension when numTemporalSeries > 1 and month is provided', () => {
      const params = {
        month: 6,
        year: 2024,
        siteId: 'multi-month-site',
        dimensions: ['path'],
        tableName: 'multi_table',
        numTemporalSeries: 2,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.include('month');
      expect(result.dimensionColumns).to.include('month');
      expect(result.dimensionColumnsPrefixed).to.include('a.month');
    });

    it('should not add temporal dimension when numTemporalSeries is 1', () => {
      const params = {
        week: 45,
        year: 2024,
        siteId: 'single-series-site',
        dimensions: ['path'],
        tableName: 'single_table',
        numTemporalSeries: 1,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.not.include('week');
      expect(result.dimensionColumns).to.not.include('week');
    });

    it('should use default pageViewThreshold of 1000', () => {
      const params = {
        week: 10,
        year: 2024,
        siteId: 'default-threshold-site',
        dimensions: ['path'],
        tableName: 'threshold_table',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageViewThreshold).to.equal(1000);
    });

    it('should throw error when siteId is missing', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        tableName: 'test_table',
        week: 10,
        year: 2024,
      })).to.throw('Missing required parameters: siteId, or tableName');
    });

    it('should throw error when tableName is missing', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        siteId: 'test-site',
        week: 10,
        year: 2024,
      })).to.throw('Missing required parameters: siteId, or tableName');
    });

    it('should throw error when both siteId and tableName are missing', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        week: 10,
        year: 2024,
      })).to.throw('Missing required parameters: siteId, or tableName');
    });

    it('should throw error when week, month, and year are all missing without temporalCondition', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        siteId: 'test-site',
        tableName: 'test_table',
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should throw error when only year is provided without temporalCondition', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        siteId: 'test-site',
        tableName: 'test_table',
        year: 2024,
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should throw error when only week is provided without year', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        siteId: 'test-site',
        tableName: 'test_table',
        week: 10,
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should throw error when only month is provided without year', () => {
      expect(() => getTrafficAnalysisQueryPlaceholdersFilled({
        siteId: 'test-site',
        tableName: 'test_table',
        month: 6,
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should handle complex dimensions with special characters', () => {
      const params = {
        week: 25,
        year: 2024,
        siteId: 'complex-dims-site',
        dimensions: ['utm_source', 'utm_medium', 'utm_campaign', 'device', 'trf_channel'],
        tableName: 'complex_table',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.groupBy).to.equal('utm_source, utm_medium, utm_campaign, device, trf_channel');
      expect(result.dimensionColumns).to.equal('utm_source, utm_medium, utm_campaign, device, trf_channel');
      expect(result.dimensionColumnsPrefixed).to.equal('a.utm_source, a.utm_medium, a.utm_campaign, a.device, a.trf_channel');
    });
  });

  describe('getTop3PagesWithTrafficLostTemplate', () => {
    it('should generate top 3 pages query with all parameters', () => {
      const params = {
        siteId: 'test-site-123',
        tableName: 'traffic_table',
        temporalCondition: 'year=2024 AND week=45',
        dimensionColumns: 'path, device',
        groupBy: 'path, device',
        dimensionColumnsPrefixed: 'a.path, a.device',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);

      // Verify CTEs are present
      expect(result).to.include('WITH min_totals AS');
      expect(result).to.include('raw AS');
      expect(result).to.include('agg AS');
      expect(result).to.include('grand_total AS');

      // Verify siteId
      expect(result).to.include("siteid = 'test-site-123'");

      // Verify consent filter
      expect(result).to.include("consent='show'");

      // Verify tableName
      expect(result).to.include('FROM traffic_table');

      // Verify temporal condition
      expect(result).to.include('year=2024 AND week=45');

      // Verify pageViewThreshold
      expect(result).to.include('SUM(pageviews) >= 1000');

      // Verify limit
      expect(result).to.include('LIMIT 3');

      // Verify dimensions
      expect(result).to.include('path, device');
      expect(result).to.include('a.path, a.device');

      // Verify ORDER BY
      expect(result).to.include('ORDER BY traffic_loss DESC');
    });

    it('should include traffic_loss calculation', () => {
      const params = {
        siteId: 'loss-calc-site',
        tableName: 'loss_table',
        temporalCondition: 'year=2024 AND month=3',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 500,
        limit: 5,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('traffic_loss');
      expect(result).to.include('CAST(a.pageviews AS DOUBLE) * (1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0))');
    });

    it('should include bounce_rate calculation', () => {
      const params = {
        siteId: 'bounce-site',
        tableName: 'bounce_table',
        temporalCondition: 'year=2024 AND week=10',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('bounce_rate');
      expect(result).to.include('1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)');
    });

    it('should include all engagement metrics', () => {
      const params = {
        siteId: 'metrics-site',
        tableName: 'metrics_table',
        temporalCondition: 'year=2024 AND month=6',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 10,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      // Verify all metrics are present
      expect(result).to.include('pageviews');
      expect(result).to.include('pct_pageviews');
      expect(result).to.include('click_rate');
      expect(result).to.include('engagement_rate');
      expect(result).to.include('engaged_scroll_rate');
      expect(result).to.include('p70_scroll');
      expect(result).to.include('p70_lcp');
      expect(result).to.include('p70_cls');
      expect(result).to.include('p70_inp');
    });

    it('should include Core Web Vitals aggregations', () => {
      const params = {
        siteId: 'cwv-site',
        tableName: 'cwv_table',
        temporalCondition: 'year=2024 AND month=9',
        dimensionColumns: 'path, device',
        groupBy: 'path, device',
        dimensionColumnsPrefixed: 'a.path, a.device',
        pageViewThreshold: 2000,
        limit: 5,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('approx_percentile(lcp, 0.70)');
      expect(result).to.include('approx_percentile(cls, 0.70)');
      expect(result).to.include('approx_percentile(inp, 0.70)');
      expect(result).to.include('approx_percentile(latest_scroll, 0.70)');
    });

    it('should include engaged_scroll calculation', () => {
      const params = {
        siteId: 'scroll-site',
        tableName: 'scroll_table',
        temporalCondition: 'year=2024 AND week=30',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 750,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('CASE WHEN latest_scroll >= 10000 THEN 1 ELSE 0 END AS engaged_scroll');
      expect(result).to.include('engaged_scroll');
      expect(result).to.include('engaged_scroll_rate');
    });

    it('should include all raw data columns', () => {
      const params = {
        siteId: 'columns-site',
        tableName: 'columns_table',
        temporalCondition: 'year=2024 AND month=12',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      // Verify all columns in raw CTE
      const rawColumns = [
        'week',
        'month',
        'path',
        'trf_type',
        'trf_channel',
        'trf_platform',
        'device',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'referrer',
        'consent',
        'notfound',
        'pageviews',
        'clicked',
        'engaged',
        'latest_scroll',
        'lcp',
        'cls',
        'inp',
      ];

      rawColumns.forEach((col) => {
        expect(result).to.include(col);
      });
    });

    it('should work without limit parameter', () => {
      const params = {
        siteId: 'no-limit-site',
        tableName: 'no_limit_table',
        temporalCondition: 'year=2024 AND week=15',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 500,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.not.include('LIMIT');
    });

    it('should work with limit set to 0', () => {
      const params = {
        siteId: 'zero-limit-site',
        tableName: 'zero_limit_table',
        temporalCondition: 'year=2024 AND week=20',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 0,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.not.include('LIMIT');
    });

    it('should join min_totals with raw data', () => {
      const params = {
        siteId: 'join-test-site',
        tableName: 'join_table',
        temporalCondition: 'year=2024 AND month=5',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1500,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('JOIN min_totals t ON m.path = t.min_key');
    });

    it('should filter by consent=show in both CTEs', () => {
      const params = {
        siteId: 'consent-site',
        tableName: 'consent_table',
        temporalCondition: 'year=2024 AND week=25',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      // Should appear twice: once in min_totals and once in raw
      const matches = result.match(/consent='show'/g);
      expect(matches).to.have.lengthOf(2);
    });

    it('should use NULLIF to avoid division by zero', () => {
      const params = {
        siteId: 'nullif-site',
        tableName: 'nullif_table',
        temporalCondition: 'year=2024 AND month=8',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('NULLIF(a.row_count, 0)');
      expect(result).to.include('NULLIF(t.total_pv, 0)');
    });

    it('should cast aggregations to appropriate types', () => {
      const params = {
        siteId: 'cast-site',
        tableName: 'cast_table',
        temporalCondition: 'year=2024 AND week=35',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('CAST(SUM(pageviews) AS BIGINT)');
      expect(result).to.include('CAST(SUM(clicked) AS BIGINT)');
      expect(result).to.include('CAST(SUM(engaged) AS BIGINT)');
      expect(result).to.include('CAST(SUM(engaged_scroll) AS BIGINT)');
      expect(result).to.include('CAST(a.pageviews AS DOUBLE)');
      expect(result).to.include('CAST(a.clicks AS DOUBLE)');
      expect(result).to.include('CAST(a.engagements AS DOUBLE)');
      expect(result).to.include('CAST(a.engaged_scroll AS DOUBLE)');
    });

    it('should handle multiple dimensions', () => {
      const params = {
        siteId: 'multi-dim-site',
        tableName: 'multi_dim_table',
        temporalCondition: 'year=2024 AND month=11',
        dimensionColumns: 'path, device, utm_campaign',
        groupBy: 'path, device, utm_campaign',
        dimensionColumnsPrefixed: 'a.path, a.device, a.utm_campaign',
        pageViewThreshold: 2000,
        limit: 10,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('path, device, utm_campaign');
      expect(result).to.include('a.path, a.device, a.utm_campaign');
      expect(result).to.include('GROUP BY path, device, utm_campaign');
    });

    it('should produce valid SQL structure', () => {
      const params = {
        siteId: 'structure-site',
        tableName: 'structure_table',
        temporalCondition: 'year=2024 AND week=40',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      // Check for common SQL syntax issues
      expect(result).to.not.include('undefined');
      expect(result).to.not.include('null');
      expect(result).to.not.match(/,,/); // No double commas
      expect(result).to.not.match(/WHERE\s+AND/); // No WHERE AND without condition
    });

    it('should cross join agg with grand_total', () => {
      const params = {
        siteId: 'crossjoin-site',
        tableName: 'crossjoin_table',
        temporalCondition: 'year=2024 AND month=7',
        dimensionColumns: 'path',
        groupBy: 'path',
        dimensionColumnsPrefixed: 'a.path',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTop3PagesWithTrafficLostTemplate(params);

      expect(result).to.include('FROM agg a');
      expect(result).to.include('CROSS JOIN grand_total t');
    });
  });

  describe('getTrafficTypeAnalysisTemplate', () => {
    it('should generate traffic type analysis query with all parameters', () => {
      const params = {
        siteId: 'test-site-123',
        tableName: 'traffic_table',
        temporalCondition: 'year=2024 AND week=45',
        dimensionColumns: 'trf_type, device',
        groupBy: 'trf_type, device',
        dimensionColumnsPrefixed: 'a.trf_type, a.device',
        pageViewThreshold: 1000,
        limit: 10,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);

      // Verify CTEs are present
      expect(result).to.include('WITH min_totals AS');
      expect(result).to.include('raw AS');
      expect(result).to.include('agg AS');
      expect(result).to.include('grand_total AS');

      // Verify siteId
      expect(result).to.include("siteid = 'test-site-123'");

      // Verify NO consent filter (key difference from getTop3PagesWithTrafficLostTemplate)
      expect(result).to.not.include("consent='show'");

      // Verify tableName
      expect(result).to.include('FROM traffic_table');

      // Verify temporal condition
      expect(result).to.include('year=2024 AND week=45');

      // Verify pageViewThreshold
      expect(result).to.include('SUM(pageviews) >= 1000');

      // Verify limit
      expect(result).to.include('LIMIT 10');

      // Verify dimensions
      expect(result).to.include('trf_type, device');
      expect(result).to.include('a.trf_type, a.device');

      // Verify ORDER BY
      expect(result).to.include('ORDER BY traffic_loss DESC');
    });

    it('should include traffic_loss calculation', () => {
      const params = {
        siteId: 'loss-calc-site',
        tableName: 'loss_table',
        temporalCondition: 'year=2024 AND month=3',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 500,
        limit: 5,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('traffic_loss');
      expect(result).to.include('CAST(a.pageviews AS DOUBLE) * (1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0))');
    });

    it('should include bounce_rate calculation', () => {
      const params = {
        siteId: 'bounce-site',
        tableName: 'bounce_table',
        temporalCondition: 'year=2024 AND week=10',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('bounce_rate');
      expect(result).to.include('1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)');
    });

    it('should include all engagement metrics', () => {
      const params = {
        siteId: 'metrics-site',
        tableName: 'metrics_table',
        temporalCondition: 'year=2024 AND month=6',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 10,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      // Verify all metrics are present
      expect(result).to.include('pageviews');
      expect(result).to.include('pct_pageviews');
      expect(result).to.include('click_rate');
      expect(result).to.include('engagement_rate');
      expect(result).to.include('engaged_scroll_rate');
      expect(result).to.include('p70_scroll');
      expect(result).to.include('p70_lcp');
      expect(result).to.include('p70_cls');
      expect(result).to.include('p70_inp');
    });

    it('should include Core Web Vitals aggregations', () => {
      const params = {
        siteId: 'cwv-site',
        tableName: 'cwv_table',
        temporalCondition: 'year=2024 AND month=9',
        dimensionColumns: 'trf_type, device',
        groupBy: 'trf_type, device',
        dimensionColumnsPrefixed: 'a.trf_type, a.device',
        pageViewThreshold: 2000,
        limit: 5,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('approx_percentile(lcp, 0.70)');
      expect(result).to.include('approx_percentile(cls, 0.70)');
      expect(result).to.include('approx_percentile(inp, 0.70)');
      expect(result).to.include('approx_percentile(latest_scroll, 0.70)');
    });

    it('should include engaged_scroll calculation', () => {
      const params = {
        siteId: 'scroll-site',
        tableName: 'scroll_table',
        temporalCondition: 'year=2024 AND week=30',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 750,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('CASE WHEN latest_scroll >= 10000 THEN 1 ELSE 0 END AS engaged_scroll');
      expect(result).to.include('engaged_scroll');
      expect(result).to.include('engaged_scroll_rate');
    });

    it('should include all raw data columns', () => {
      const params = {
        siteId: 'columns-site',
        tableName: 'columns_table',
        temporalCondition: 'year=2024 AND month=12',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      // Verify all columns in raw CTE
      const rawColumns = [
        'week',
        'month',
        'path',
        'trf_type',
        'trf_channel',
        'trf_platform',
        'device',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'referrer',
        'consent',
        'notfound',
        'pageviews',
        'clicked',
        'engaged',
        'latest_scroll',
        'lcp',
        'cls',
        'inp',
      ];

      rawColumns.forEach((col) => {
        expect(result).to.include(col);
      });
    });

    it('should work without limit parameter', () => {
      const params = {
        siteId: 'no-limit-site',
        tableName: 'no_limit_table',
        temporalCondition: 'year=2024 AND week=15',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 500,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.not.include('LIMIT');
    });

    it('should work with limit set to 0', () => {
      const params = {
        siteId: 'zero-limit-site',
        tableName: 'zero_limit_table',
        temporalCondition: 'year=2024 AND week=20',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 0,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.not.include('LIMIT');
    });

    it('should join min_totals with raw data', () => {
      const params = {
        siteId: 'join-test-site',
        tableName: 'join_table',
        temporalCondition: 'year=2024 AND month=5',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1500,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('JOIN min_totals t ON m.path = t.min_key');
    });

    it('should NOT filter by consent (key difference from getTop3PagesWithTrafficLostTemplate)', () => {
      const params = {
        siteId: 'no-consent-site',
        tableName: 'no_consent_table',
        temporalCondition: 'year=2024 AND week=25',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      // Should NOT appear at all
      expect(result).to.not.include("consent='show'");
      expect(result).to.not.include('consent=');
    });

    it('should use NULLIF to avoid division by zero', () => {
      const params = {
        siteId: 'nullif-site',
        tableName: 'nullif_table',
        temporalCondition: 'year=2024 AND month=8',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('NULLIF(a.row_count, 0)');
      expect(result).to.include('NULLIF(t.total_pv, 0)');
    });

    it('should cast aggregations to appropriate types', () => {
      const params = {
        siteId: 'cast-site',
        tableName: 'cast_table',
        temporalCondition: 'year=2024 AND week=35',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('CAST(SUM(pageviews) AS BIGINT)');
      expect(result).to.include('CAST(SUM(clicked) AS BIGINT)');
      expect(result).to.include('CAST(SUM(engaged) AS BIGINT)');
      expect(result).to.include('CAST(SUM(engaged_scroll) AS BIGINT)');
      expect(result).to.include('CAST(a.pageviews AS DOUBLE)');
      expect(result).to.include('CAST(a.clicks AS DOUBLE)');
      expect(result).to.include('CAST(a.engagements AS DOUBLE)');
      expect(result).to.include('CAST(a.engaged_scroll AS DOUBLE)');
    });

    it('should handle multiple dimensions', () => {
      const params = {
        siteId: 'multi-dim-site',
        tableName: 'multi_dim_table',
        temporalCondition: 'year=2024 AND month=11',
        dimensionColumns: 'trf_type, trf_channel, device',
        groupBy: 'trf_type, trf_channel, device',
        dimensionColumnsPrefixed: 'a.trf_type, a.trf_channel, a.device',
        pageViewThreshold: 2000,
        limit: 10,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('trf_type, trf_channel, device');
      expect(result).to.include('a.trf_type, a.trf_channel, a.device');
      expect(result).to.include('GROUP BY trf_type, trf_channel, device');
    });

    it('should produce valid SQL structure', () => {
      const params = {
        siteId: 'structure-site',
        tableName: 'structure_table',
        temporalCondition: 'year=2024 AND week=40',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      // Check for common SQL syntax issues
      expect(result).to.not.include('undefined');
      expect(result).to.not.include('null');
      expect(result).to.not.match(/,,/); // No double commas
      expect(result).to.not.match(/WHERE\s+AND/); // No WHERE AND without condition
    });

    it('should cross join agg with grand_total', () => {
      const params = {
        siteId: 'crossjoin-site',
        tableName: 'crossjoin_table',
        temporalCondition: 'year=2024 AND month=7',
        dimensionColumns: 'trf_type',
        groupBy: 'trf_type',
        dimensionColumnsPrefixed: 'a.trf_type',
        pageViewThreshold: 1000,
        limit: 3,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('FROM agg a');
      expect(result).to.include('CROSS JOIN grand_total t');
    });

    it('should handle trf_type as a dimension', () => {
      const params = {
        siteId: 'trf-type-dim-site',
        tableName: 'trf_type_table',
        temporalCondition: 'year=2024 AND month=4',
        dimensionColumns: 'trf_type, trf_channel, trf_platform',
        groupBy: 'trf_type, trf_channel, trf_platform',
        dimensionColumnsPrefixed: 'a.trf_type, a.trf_channel, a.trf_platform',
        pageViewThreshold: 1000,
        limit: 5,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('trf_type');
      expect(result).to.include('trf_channel');
      expect(result).to.include('trf_platform');
    });

    it('should handle path dimension alongside traffic dimensions', () => {
      const params = {
        siteId: 'mixed-dim-site',
        tableName: 'mixed_table',
        temporalCondition: 'year=2024 AND week=28',
        dimensionColumns: 'path, trf_type',
        groupBy: 'path, trf_type',
        dimensionColumnsPrefixed: 'a.path, a.trf_type',
        pageViewThreshold: 800,
        limit: 20,
      };

      const result = getTrafficTypeAnalysisTemplate(params);

      expect(result).to.include('path, trf_type');
      expect(result).to.include('a.path, a.trf_type');
      expect(result).to.include('GROUP BY path, trf_type');
    });
  });
});
