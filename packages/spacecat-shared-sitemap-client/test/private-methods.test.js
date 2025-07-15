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
/* eslint-disable no-underscore-dangle */

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import esmock from 'esmock';

use(sinonChai);

describe('SitemapClient Private Methods', () => {
  let sandbox;
  let mockContext;
  let mockGetStoredMetrics;
  let SitemapClient;

  const siteId = 'test-site-id';
  const mockLog = {
    info: sinon.stub(),
    error: sinon.stub(),
  };

  const mockRawData = {
    robots: {
      url: 'https://example.com/robots.txt',
      content: 'User-agent: *\nDisallow: /admin/',
    },
    sitemaps: [
      {
        url: 'https://example.com/sitemap.xml',
        content: '<urlset>...</urlset>',
        type: 'urlset',
        fetchedAt: '2024-01-01T00:00:00Z',
      },
    ],
    sitemap_index: [
      {
        url: 'https://example.com/sitemap-index.xml',
        content: '<sitemapindex>...</sitemapindex>',
        type: 'sitemapindex',
        fetchedAt: '2024-01-01T00:00:00Z',
      },
    ],
  };

  const mockHierarchicalData = {
    root: 'https://example.com',
    sitemaps: [
      {
        url: 'https://example.com/sitemap-index.xml',
        type: 'sitemapindex',
        children: [
          {
            url: 'https://example.com/sitemap.xml',
            type: 'urlset',
            children: [
              {
                url: 'https://example.com/page1.html',
                lastmod: '2024-01-01T00:00:00Z',
                changefreq: 'weekly',
                priority: 0.8,
                videos: [],
                images: [],
                alternates: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const mockFlatData = {
    entries: [
      {
        url: 'https://example.com/page1.html',
        lastmod: '2024-01-01T00:00:00Z',
        changefreq: 'weekly',
        priority: 0.8,
        videos: [],
        images: [],
        alternates: [],
      },
      {
        url: 'https://example.com/page2.html',
        lastmod: '2024-01-02T00:00:00Z',
        changefreq: 'daily',
        priority: 0.6,
        videos: [],
        images: [],
        alternates: [],
      },
    ],
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mockContext = {
      log: mockLog,
    };

    // Reset log stubs
    mockLog.info.resetHistory();
    mockLog.error.resetHistory();

    // Create mock for getStoredMetrics
    mockGetStoredMetrics = sandbox.stub();

    // Mock the @adobe/spacecat-shared-utils module
    SitemapClient = await esmock('../src/index.js', {
      '@adobe/spacecat-shared-utils': {
        getStoredMetrics: mockGetStoredMetrics,
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('_loadRawData', () => {
    it('should successfully load and cache raw data', async () => {
      mockGetStoredMetrics.resolves(mockRawData);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadRawData();

      expect(result).to.deep.equal(mockRawData);
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-raw',
      }, mockContext);
      expect(mockLog.info).to.have.been.calledWith(`Successfully loaded raw sitemap data for site: ${siteId}`);
      expect(client._rawData).to.equal(mockRawData);
    });

    it('should handle errors and return fallback data', async () => {
      const error = new Error('Network failure');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadRawData();

      expect(result).to.deep.equal({ robots: null, sitemaps: [], sitemap_index: [] });
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-raw',
      }, mockContext);
      expect(mockLog.error).to.have.been.calledWith(`Failed to load raw sitemap data for site: ${siteId}, error: Network failure`);
      expect(client._rawData).to.deep.equal({ robots: null, sitemaps: [], sitemap_index: [] });
    });

    it('should return cached data on subsequent calls', async () => {
      mockGetStoredMetrics.resolves(mockRawData);
      const client = new SitemapClient(siteId, mockContext);

      // First call should fetch data
      const result1 = await client._loadRawData();
      expect(result1).to.deep.equal(mockRawData);

      // Second call should return cached data without calling getStoredMetrics again
      const result2 = await client._loadRawData();
      expect(result2).to.deep.equal(mockRawData);
      expect(result2).to.equal(result1); // Should be the same object reference

      expect(mockGetStoredMetrics).to.have.been.calledOnce;
      expect(mockLog.info).to.have.been.calledOnce;
    });

    it('should handle errors with custom error messages', async () => {
      const error = new Error('Connection timeout');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadRawData();

      expect(result).to.deep.equal({ robots: null, sitemaps: [], sitemap_index: [] });
      expect(mockLog.error).to.have.been.calledWith(`Failed to load raw sitemap data for site: ${siteId}, error: Connection timeout`);
    });
  });

  describe('_loadHierarchicalData', () => {
    it('should successfully load and cache hierarchical data', async () => {
      mockGetStoredMetrics.resolves(mockHierarchicalData);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadHierarchicalData();

      expect(result).to.deep.equal(mockHierarchicalData);
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-hierarchical',
      }, mockContext);
      expect(mockLog.info).to.have.been.calledWith(`Successfully loaded hierarchical sitemap data for site: ${siteId}`);
      expect(client._hierarchicalData).to.equal(mockHierarchicalData);
    });

    it('should handle errors and return fallback data', async () => {
      const error = new Error('Database error');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadHierarchicalData();

      expect(result).to.deep.equal({ root: '', sitemaps: [] });
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-hierarchical',
      }, mockContext);
      expect(mockLog.error).to.have.been.calledWith(`Failed to load hierarchical sitemap data for site: ${siteId}, error: Database error`);
      expect(client._hierarchicalData).to.deep.equal({ root: '', sitemaps: [] });
    });

    it('should return cached data on subsequent calls', async () => {
      mockGetStoredMetrics.resolves(mockHierarchicalData);
      const client = new SitemapClient(siteId, mockContext);

      // First call should fetch data
      const result1 = await client._loadHierarchicalData();
      expect(result1).to.deep.equal(mockHierarchicalData);

      // Second call should return cached data without calling getStoredMetrics again
      const result2 = await client._loadHierarchicalData();
      expect(result2).to.deep.equal(mockHierarchicalData);
      expect(result2).to.equal(result1); // Should be the same object reference

      expect(mockGetStoredMetrics).to.have.been.calledOnce;
      expect(mockLog.info).to.have.been.calledOnce;
    });

    it('should handle errors with different error types', async () => {
      const error = new Error('Access denied');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadHierarchicalData();

      expect(result).to.deep.equal({ root: '', sitemaps: [] });
      expect(mockLog.error).to.have.been.calledWith(`Failed to load hierarchical sitemap data for site: ${siteId}, error: Access denied`);
    });
  });

  describe('_loadFlatData', () => {
    it('should successfully load and cache flat data', async () => {
      mockGetStoredMetrics.resolves(mockFlatData);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadFlatData();

      expect(result).to.deep.equal(mockFlatData);
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-flat',
      }, mockContext);
      expect(mockLog.info).to.have.been.calledWith(`Successfully loaded flat sitemap data for site: ${siteId}`);
      expect(client._flatData).to.equal(mockFlatData);
    });

    it('should handle errors and return fallback data', async () => {
      const error = new Error('Service unavailable');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadFlatData();

      expect(result).to.deep.equal({ entries: [] });
      expect(mockGetStoredMetrics).to.have.been.calledWith({
        siteId,
        source: 'sitemap',
        metric: 'sitemap-flat',
      }, mockContext);
      expect(mockLog.error).to.have.been.calledWith(`Failed to load flat sitemap data for site: ${siteId}, error: Service unavailable`);
      expect(client._flatData).to.deep.equal({ entries: [] });
    });

    it('should return cached data on subsequent calls', async () => {
      mockGetStoredMetrics.resolves(mockFlatData);
      const client = new SitemapClient(siteId, mockContext);

      // First call should fetch data
      const result1 = await client._loadFlatData();
      expect(result1).to.deep.equal(mockFlatData);

      // Second call should return cached data without calling getStoredMetrics again
      const result2 = await client._loadFlatData();
      expect(result2).to.deep.equal(mockFlatData);
      expect(result2).to.equal(result1); // Should be the same object reference

      expect(mockGetStoredMetrics).to.have.been.calledOnce;
      expect(mockLog.info).to.have.been.calledOnce;
    });

    it('should handle errors with various error messages', async () => {
      const error = new Error('Invalid response format');
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadFlatData();

      expect(result).to.deep.equal({ entries: [] });
      expect(mockLog.error).to.have.been.calledWith(`Failed to load flat sitemap data for site: ${siteId}, error: Invalid response format`);
    });
  });

  describe('Data Loading Integration', () => {
    it('should work with mixed successful and failed data loads', async () => {
      const client = new SitemapClient(siteId, mockContext);

      // First method succeeds
      mockGetStoredMetrics.onFirstCall().resolves(mockRawData);
      // Second method fails
      mockGetStoredMetrics.onSecondCall().rejects(new Error('Network error'));
      // Third method succeeds
      mockGetStoredMetrics.onThirdCall().resolves(mockFlatData);

      const rawResult = await client._loadRawData();
      const hierarchicalResult = await client._loadHierarchicalData();
      const flatResult = await client._loadFlatData();

      expect(rawResult).to.deep.equal(mockRawData);
      expect(hierarchicalResult).to.deep.equal({ root: '', sitemaps: [] });
      expect(flatResult).to.deep.equal(mockFlatData);

      expect(mockGetStoredMetrics).to.have.been.calledThrice;
      expect(mockLog.info).to.have.been.calledTwice;
      expect(mockLog.error).to.have.been.calledOnce;
    });

    it('should maintain separate caches for different data types', async () => {
      const client = new SitemapClient(siteId, mockContext);

      mockGetStoredMetrics.onFirstCall().resolves(mockRawData);
      mockGetStoredMetrics.onSecondCall().resolves(mockHierarchicalData);
      mockGetStoredMetrics.onThirdCall().resolves(mockFlatData);

      // Load all data types
      await client._loadRawData();
      await client._loadHierarchicalData();
      await client._loadFlatData();

      // Verify separate caches
      expect(client._rawData).to.equal(mockRawData);
      expect(client._hierarchicalData).to.equal(mockHierarchicalData);
      expect(client._flatData).to.equal(mockFlatData);

      // Second calls should use cached data
      await client._loadRawData();
      await client._loadHierarchicalData();
      await client._loadFlatData();

      // Should still only have called getStoredMetrics 3 times (once for each data type)
      expect(mockGetStoredMetrics).to.have.been.calledThrice;
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle errors without error.message property', async () => {
      const error = { toString: () => 'Custom error object' };
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadRawData();

      expect(result).to.deep.equal({ robots: null, sitemaps: [], sitemap_index: [] });
      expect(mockLog.error).to.have.been.calledWith(`Failed to load raw sitemap data for site: ${siteId}, error: undefined`);
    });

    it('should handle null/undefined error messages', async () => {
      const error = new Error();
      error.message = undefined;
      mockGetStoredMetrics.rejects(error);
      const client = new SitemapClient(siteId, mockContext);

      const result = await client._loadHierarchicalData();

      expect(result).to.deep.equal({ root: '', sitemaps: [] });
      expect(mockLog.error).to.have.been.calledWith(`Failed to load hierarchical sitemap data for site: ${siteId}, error: undefined`);
    });
  });
});
