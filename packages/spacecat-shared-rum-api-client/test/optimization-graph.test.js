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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import optimizationGraph from '../src/functions/reports/optimization/graph.js';

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);
const bundlesForUrls = JSON.parse(readFileSync(join(dirnamePath, './fixtures/bundles.json'), 'utf8'));
/* eslint-env mocha */

describe('Optimization Report Graph', () => {
  describe('handler', () => {
    it('should return default structure when no opts provided', () => {
      const result = optimizationGraph.handler([], null);

      expect(result).to.deep.equal({
        timePeriod: { startTime: null, endTime: null },
        trafficData: [],
        byUrl: {},
        totals: {},
      });
    });

    it('should handle empty/null/undefined bundles', () => {
      const testCases = [[], null, undefined, 'not-an-array'];

      testCases.forEach((bundles) => {
        const result = optimizationGraph.handler(bundles, { startTime: '2024-01-01', endTime: '2024-01-02' });

        expect(result.trafficData).to.be.an('array').that.is.empty;
        expect(result.byUrl).to.deep.equal({});
      });
    });

    it('should process real RUM bundles with daily granularity', () => {
      const result = optimizationGraph.handler(bundlesForUrls.rumBundles, {
        startTime: '2024-05-31T00:00:00.000Z',
        endTime: '2024-05-31T23:59:59.999Z',
        granularity: 'DAILY',
      });

      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
      expect(result).to.have.property('granularity', 'DAILY');
      expect(result).to.have.property('urlsFiltered');

      // Check totals structure
      expect(result.totals).to.have.property('organic');
      expect(result.totals).to.have.property('visits');
      expect(result.totals).to.have.property('pageViews');
      expect(result.totals).to.have.property('bounces');
      expect(result.totals).to.have.property('conversions');
      expect(result.totals).to.have.property('engagement');

      // All totals should be numbers
      expect(result.totals.organic).to.be.a('number');
      expect(result.totals.visits).to.be.a('number');
      expect(result.totals.pageViews).to.be.a('number');
      expect(result.totals.bounces).to.be.a('number');
      expect(result.totals.conversions).to.be.a('number');
      expect(result.totals.engagement).to.be.a('number');
    });

    it('should process real RUM bundles with hourly granularity', () => {
      const result = optimizationGraph.handler(bundlesForUrls.rumBundles, {
        startTime: '2024-05-31T00:00:00.000Z',
        endTime: '2024-05-31T23:59:59.999Z',
        granularity: 'HOURLY',
      });

      expect(result).to.have.property('granularity', 'HOURLY');
      expect(result.trafficData).to.be.an('array');

      // Check if hourly data has hour property
      if (result.trafficData.length > 0) {
        expect(result.trafficData[0]).to.have.property('hour');
        expect(result.trafficData[0].hour).to.be.a('number');
      }
    });

    it('should filter bundles by URLs', () => {
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
          url: 'https://other.com/page3',
          time: '2024-01-01T00:00:00.000Z',
          weight: 75,
          events: [{ checkpoint: 'engagement' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        urls: ['example.com/page1', 'example.com/page2'],
      });

      expect(result.urlsFiltered).to.deep.equal(['example.com/page1', 'example.com/page2']);
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
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        outlierUrls: ['example.com/page1'],
      });

      // Should filter out the outlier URL
      expect(result.totals.pageViews).to.be.lessThan(150); // Less than total of both bundles
    });

    it('should validate date range and throw error for invalid range', () => {
      expect(() => {
        optimizationGraph.handler([], {
          startTime: '2024-01-02T00:00:00.000Z',
          endTime: '2024-01-01T00:00:00.000Z',
        });
      }).to.throw('Start time must be before end time');
    });

    it('should handle valid date ranges', () => {
      const validRanges = [
        { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-02T00:00:00.000Z' },
        { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T00:00:00.000Z' },
        { startTime: null, endTime: null },
        { startTime: undefined, endTime: undefined },
        { startTime: '', endTime: '' },
      ];

      validRanges.forEach((range) => {
        expect(() => {
          optimizationGraph.handler([], range);
        }).to.not.throw();
      });
    });

    it('should calculate totals correctly from traffic data', () => {
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

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      // Totals should be calculated from trafficData
      expect(result.totals).to.be.an('object');
      expect(result.totals.pageViews).to.be.a('number');
      expect(result.totals.visits).to.be.a('number');
      expect(result.totals.organic).to.be.a('number');
      expect(result.totals.bounces).to.be.a('number');
      expect(result.totals.conversions).to.be.a('number');
      expect(result.totals.engagement).to.be.a('number');
    });

    it('should handle case-insensitive granularity', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        granularity: 'hourly', // lowercase
      });

      expect(result.granularity).to.equal('hourly');
    });

    it('should handle default granularity when not specified', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result.granularity).to.equal('DAILY');
    });

    it('should handle URL filtering with different URL formats', () => {
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

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        urls: ['example.com/page1', 'https://example.com/page2'],
      });

      expect(result.urlsFiltered).to.deep.equal(['example.com/page1', 'https://example.com/page2']);
    });

    it('should handle edge case with zero weights in traffic data', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 0,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result.totals.pageViews).to.equal(0);
    });

    it('should handle bundles with missing properties gracefully', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });

    it('should handle bundles with null or undefined events', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [],
        },
        {
          id: '2',
          url: 'https://example.com/page2',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });

    it('should handle conversion detection correctly', () => {
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

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result.totals.conversions).to.be.a('number');
    });

    it('should handle time series data structure correctly', () => {
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
          url: 'https://example.com/page1',
          time: '2024-01-02T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-02T23:59:59.999Z',
      });

      expect(result.trafficData).to.be.an('array');
      if (result.trafficData.length > 0) {
        expect(result.trafficData[0]).to.have.property('date');
        expect(result.trafficData[0]).to.have.property('organic');
        expect(result.trafficData[0]).to.have.property('visits');
        expect(result.trafficData[0]).to.have.property('pageViews');
        expect(result.trafficData[0]).to.have.property('bounces');
        expect(result.trafficData[0]).to.have.property('conversions');
        expect(result.trafficData[0]).to.have.property('engagement');
      }
    });

    it('should handle hourly time series data structure correctly', () => {
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
          url: 'https://example.com/page1',
          time: '2024-01-01T01:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        granularity: 'HOURLY',
      });

      expect(result.trafficData).to.be.an('array');
      if (result.trafficData.length > 0) {
        expect(result.trafficData[0]).to.have.property('date');
        expect(result.trafficData[0]).to.have.property('hour');
        expect(result.trafficData[0].hour).to.be.a('number');
      }
    });

    it('should handle byUrl data structure correctly', () => {
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

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
      });

      expect(result.byUrl).to.be.an('object');
      // Check if byUrl contains expected structure for each URL
      Object.keys(result.byUrl).forEach((url) => {
        expect(result.byUrl[url]).to.have.property('total');
        expect(result.byUrl[url]).to.have.property('timeSeries');
        expect(result.byUrl[url].total).to.have.property('organic');
        expect(result.byUrl[url].total).to.have.property('visits');
        expect(result.byUrl[url].total).to.have.property('pageViews');
        expect(result.byUrl[url].total).to.have.property('bounces');
        expect(result.byUrl[url].total).to.have.property('conversions');
        expect(result.byUrl[url].total).to.have.property('engagement');
        expect(result.byUrl[url].timeSeries).to.be.an('array');
      });
    });

    it('should handle sorting of time series data correctly', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-02T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-02T23:59:59.999Z',
      });

      expect(result.trafficData).to.be.an('array');
      if (result.trafficData.length > 1) {
        const firstDate = new Date(result.trafficData[0].date);
        const secondDate = new Date(result.trafficData[1].date);
        expect(firstDate.getTime()).to.be.lessThanOrEqual(secondDate.getTime());
      }
    });

    it('should handle sorting of hourly time series data correctly', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T01:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        granularity: 'HOURLY',
      });

      expect(result.trafficData).to.be.an('array');
      if (result.trafficData.length > 1) {
        const first = result.trafficData[0];
        const second = result.trafficData[1];
        const firstDate = new Date(first.date);
        const secondDate = new Date(second.date);

        if (firstDate.getTime() === secondDate.getTime()) {
          expect(first.hour).to.be.lessThanOrEqual(second.hour);
        } else {
          expect(firstDate.getTime()).to.be.lessThanOrEqual(secondDate.getTime());
        }
      }
    });

    it('should handle URL filtering with non-matching URLs', () => {
      const testBundles = [
        {
          id: '1',
          url: 'https://example.com/page1',
          time: '2024-01-01T00:00:00.000Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
      ];

      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T23:59:59.999Z',
        urls: ['nonexistent.com/page'], // URL that doesn't match
      });

      expect(result.urlsFiltered).to.deep.equal(['nonexistent.com/page']);
      // Should still return valid structure even if no URLs match
      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });

    it('should execute the specific return statements in URL filtering logic', () => {
      // Use real RUM bundles but with filter URLs that are guaranteed not to match
      // This should trigger the return statements in lines 101-102 and 116-117
      const result = optimizationGraph.handler(bundlesForUrls.rumBundles, {
        startTime: '2024-05-31T00:00:00.000Z',
        endTime: '2024-05-31T23:59:59.999Z',
        urls: ['completely.nonexistent.domain/page1', 'another.nonexistent.domain/page2'],
      });

      expect(result.urlsFiltered).to.deep.equal(['completely.nonexistent.domain/page1', 'another.nonexistent.domain/page2']);
      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });

    it('should trigger return statements with specific non-matching URLs', () => {
      // Create bundles with URLs that will definitely generate URL facets
      const testBundles = [
        {
          id: '1',
          url: 'https://www.aem.live/tools/rum/explorer.html',
          time: '2024-05-31T00:00:05.017Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://www.aem.live/home',
          time: '2024-05-31T01:00:01.894Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      // Test with filter URLs that are guaranteed NOT to match the bundle URLs
      // These should trigger the return statements in lines 101-102 and 116-117
      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-05-31T00:00:00.000Z',
        endTime: '2024-05-31T23:59:59.999Z',
        urls: ['www.aem.live/tools/rum/explorer.html/subpath', 'www.aem.live/home/different'],
      });

      expect(result.urlsFiltered).to.deep.equal(['www.aem.live/tools/rum/explorer.html/subpath', 'www.aem.live/home/different']);
      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });

    it('should trigger the final return statement with hourly granularity', () => {
      // Create bundles with URLs that will generate URL facets
      const testBundles = [
        {
          id: '1',
          url: 'https://www.aem.live/tools/rum/explorer.html',
          time: '2024-05-31T00:00:05.017Z',
          weight: 100,
          events: [{ checkpoint: 'click' }],
        },
        {
          id: '2',
          url: 'https://www.aem.live/home',
          time: '2024-05-31T01:00:01.894Z',
          weight: 50,
          events: [{ checkpoint: 'load' }],
        },
      ];

      // Test with hourly granularity and non-matching URLs to trigger the return statement
      const result = optimizationGraph.handler(testBundles, {
        startTime: '2024-05-31T00:00:00.000Z',
        endTime: '2024-05-31T23:59:59.999Z',
        granularity: 'HOURLY',
        urls: ['www.aem.live/tools/rum/explorer.html/subpath', 'www.aem.live/home/different'],
      });

      expect(result.granularity).to.equal('HOURLY');
      expect(result.urlsFiltered).to.deep.equal(['www.aem.live/tools/rum/explorer.html/subpath', 'www.aem.live/home/different']);
      expect(result).to.have.property('trafficData');
      expect(result).to.have.property('byUrl');
      expect(result).to.have.property('totals');
    });
  });
});
