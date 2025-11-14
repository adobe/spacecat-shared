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
import { expect } from 'chai';
import { initializeDataChunks, calculateMetrics, filterBundles } from '../src/functions/reports/optimization/utils.js';
/* eslint-env mocha */

describe('Optimization Utils', () => {
  describe('initializeDataChunks', () => {
    it('should initialize DataChunks with correct configuration', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('checkpoint');
      expect(dataChunks.series).to.have.property('pageViews');
      expect(dataChunks.series).to.have.property('engagement');
      expect(dataChunks.series).to.have.property('bounces');
      expect(dataChunks.series).to.have.property('organic');
      expect(dataChunks.series).to.have.property('visits');
      expect(dataChunks.series).to.have.property('conversions');
    });

    it('should include URL facet when includeUrlFacet is true', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles, { includeUrlFacet: true });

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('url');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should not include URL facet when includeUrlFacet is false', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles, { includeUrlFacet: false });

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.not.have.property('url');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should include date facet when includeDateFacet is true', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles, { includeDateFacet: true });

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('date');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should handle empty bundles array', () => {
      const dataChunks = initializeDataChunks([]);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should handle null bundles', () => {
      const dataChunks = initializeDataChunks(null);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should handle undefined bundles', () => {
      const dataChunks = initializeDataChunks(undefined);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should handle bundles with missing properties', () => {
      const testBundles = [
        {
          id: '1',
          weight: 100,
          events: [],
          // Missing url, time
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.facets).to.have.property('checkpoint');
    });

    it('should handle bundles with conversion events', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.series).to.have.property('conversions');
    });

    it('should handle bundles with engagement events', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'engagement' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.series).to.have.property('engagement');
    });

    it('should handle bundles with bounce events', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'bounce' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.series).to.have.property('bounces');
    });

    it('should handle bundles with organic traffic', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'load' }],
          referrer: 'https://google.com',
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);

      expect(dataChunks).to.be.an('object');
      expect(dataChunks.series).to.have.property('organic');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics from DataChunks instance', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);
      const result = calculateMetrics(dataChunks);

      expect(result).to.have.property('pageViews');
      expect(result).to.have.property('visits');
      expect(result).to.have.property('organicTraffic');
      expect(result).to.have.property('bounces');
      expect(result).to.have.property('engagement');
      expect(result).to.have.property('conversions');

      // Check structure of each metric
      expect(result.pageViews).to.have.property('total');
      expect(result.visits).to.have.property('total');
      expect(result.organicTraffic).to.have.property('total');
      expect(result.bounces).to.have.property('total');
      expect(result.bounces).to.have.property('rate');
      expect(result.engagement).to.have.property('total');
      expect(result.engagement).to.have.property('rate');
      expect(result.conversions).to.have.property('total');
      expect(result.conversions).to.have.property('rate');

      // All totals should be numbers
      expect(result.pageViews.total).to.be.a('number');
      expect(result.visits.total).to.be.a('number');
      expect(result.organicTraffic.total).to.be.a('number');
      expect(result.bounces.total).to.be.a('number');
      expect(result.bounces.rate).to.be.a('number');
      expect(result.engagement.total).to.be.a('number');
      expect(result.engagement.rate).to.be.a('number');
      expect(result.conversions.total).to.be.a('number');
      expect(result.conversions.rate).to.be.a('number');
    });

    it('should handle DataChunks with no data', () => {
      const dataChunks = initializeDataChunks([]);
      const result = calculateMetrics(dataChunks);

      expect(result).to.deep.equal({
        pageViews: { total: 0 },
        visits: { total: 0 },
        organicTraffic: { total: 0 },
        bounces: { total: 0, rate: 100 },
        engagement: { total: 0, rate: 100 },
        conversions: { total: 0, rate: 100 },
      });
    });

    it('should calculate conversion rates correctly', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);
      const result = calculateMetrics(dataChunks);

      // 150 total page views, 100 with clicks = 66.67% conversion rate
      expect(result.conversions.total).to.equal(100);
      expect(result.conversions.rate).to.be.closeTo(66.67, 0.01);
    });

    it('should handle zero page views for rate calculations', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com',
          time: '2024-01-01T00:00:00.000Z',
          weight: 0,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);
      const result = calculateMetrics(dataChunks);

      expect(result.pageViews.total).to.equal(0);
      expect(result.conversions.rate).to.equal(100);
    });

    it('should handle zero engagement for rate calculations', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);
      const result = calculateMetrics(dataChunks);

      expect(result.engagement.total).to.equal(0);
      expect(result.engagement.rate).to.equal(100);
    });

    it('should handle zero visits for bounce rate calculations', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [],
        },
      ];

      const dataChunks = initializeDataChunks(testBundles);
      const result = calculateMetrics(dataChunks);

      expect(result.visits.total).to.equal(0);
      expect(result.bounces.rate).to.equal(100);
    });
  });

  describe('filterBundles', () => {
    it('should return empty array for null bundles', () => {
      const result = filterBundles(null, {});

      expect(result).to.deep.equal([]);
    });

    it('should return empty array for undefined bundles', () => {
      const result = filterBundles(undefined, {});

      expect(result).to.deep.equal([]);
    });

    it('should return empty array for non-array bundles', () => {
      const result = filterBundles('not an array', {});

      expect(result).to.deep.equal([]);
    });

    it('should return original bundles when no filters applied', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const result = filterBundles(testBundles, {});

      expect(result).to.deep.equal(testBundles);
    });

    it('should filter out outlier URLs', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
        {
          id: '3',
          url: 'https://example.com/page3',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'engagement' }],
        },
      ];

      const opts = {
        outlierUrls: ['https://example.com/page2'],
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.have.length(2);
      expect(result[0].id).to.equal('1');
      expect(result[1].id).to.equal('3');
    });

    it('should filter by specific URLs', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
        {
          id: '3',
          url: 'https://example.com/page3',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'engagement' }],
        },
      ];

      const opts = {
        urls: ['https://example.com/page1', 'https://example.com/page3'],
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.have.length(2);
      expect(result[0].id).to.equal('1');
      expect(result[1].id).to.equal('3');
    });

    it('should handle both outlier URLs and specific URLs filters', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
        {
          id: '3',
          url: 'https://example.com/page3',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'engagement' }],
        },
      ];

      const opts = {
        outlierUrls: ['https://example.com/page2'],
        urls: ['https://example.com/page1', 'https://example.com/page3'],
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.have.length(2);
      expect(result[0].id).to.equal('1');
      expect(result[1].id).to.equal('3');
    });

    it('should handle empty outlier URLs array', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        outlierUrls: [],
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.deep.equal(testBundles);
    });

    it('should handle empty URLs array', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        urls: [],
      };

      const result = filterBundles(testBundles, opts);

      // Should return empty array when URLs is empty
      expect(result).to.deep.equal([]);
    });

    it('should handle null options', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = filterBundles(testBundles, null);

      expect(result).to.deep.equal(testBundles);
    });

    it('should handle undefined options', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = filterBundles(testBundles, undefined);

      expect(result).to.deep.equal(testBundles);
    });

    it('should handle options with missing outlierUrls and urls properties', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        someOtherProperty: 'value',
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.deep.equal(testBundles);
    });

    it('should handle URL filtering with partial matches', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/products/phone',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/products/laptop',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '3',
          url: 'https://example.com/about',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        urls: ['https://example.com/products'],
      };

      const result = filterBundles(testBundles, opts);

      // urlMatchesFilter does exact pathname matching, not partial matching
      // So 'https://example.com/products' won't match '/products/phone' or '/products/laptop'
      expect(result).to.have.length(0);
    });

    it('should handle outlier URL filtering with partial matches', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/products/phone',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/products/laptop',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '3',
          url: 'https://example.com/about',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        outlierUrls: ['https://example.com/products'],
      };

      const result = filterBundles(testBundles, opts);

      // urlMatchesFilter does exact pathname matching, not partial matching
      // So 'https://example.com/products' won't match '/products/phone' or '/products/laptop'
      // All bundles should remain since none match the exact outlier URL
      expect(result).to.have.length(3);
    });

    it('should handle complex filtering scenarios', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/products/phone',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/products/laptop',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '3',
          url: 'https://example.com/about',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '4',
          url: 'https://example.com/contact',
          time: '2024-01-01T00:00:00.000Z',
          weight: 25,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const opts = {
        outlierUrls: ['https://example.com/products/laptop'],
        urls: ['https://example.com/products', 'https://example.com/about'],
      };

      const result = filterBundles(testBundles, opts);

      // urlMatchesFilter does exact pathname matching
      // outlierUrls: 'https://example.com/products/laptop' will exclude bundle with id '2'
      // urls: 'https://example.com/products' and 'https://example.com/about' will only include exact matches
      // Since 'https://example.com/products' doesn't match '/products/phone', only 'about' will match
      expect(result).to.have.length(1);
      expect(result[0].id).to.equal('3');
    });

    it('should handle bundles with missing URL property', () => {
      const testBundles = [
        {
          id: '1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
          // Missing url
        },
      ];

      const opts = {
        urls: ['https://example.com/page1'],
      };

      const result = filterBundles(testBundles, opts);

      expect(result).to.have.length(0);
    });
  });
});
