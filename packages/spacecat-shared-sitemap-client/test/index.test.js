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
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SitemapClient from '../src/index.js';

use(chaiAsPromised);
use(sinonChai);

describe('SitemapClient', () => {
  let sandbox;
  let mockContext;
  let client;

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

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockContext = {
      log: mockLog,
    };
    client = new SitemapClient(siteId, mockContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should create a new SitemapClient instance', () => {
      expect(client).to.be.an.instanceof(SitemapClient);
      expect(client.siteId).to.equal(siteId);
      expect(client.context).to.equal(mockContext);
      expect(client.log).to.equal(mockLog);
    });

    it('should throw error if siteId is not provided', () => {
      expect(() => new SitemapClient(null, mockContext)).to.throw('siteId is required for SitemapClient initialization');
      expect(() => new SitemapClient('', mockContext)).to.throw('siteId is required for SitemapClient initialization');
    });

    it('should throw error if context is not provided', () => {
      expect(() => new SitemapClient(siteId, null)).to.throw('context is required for SitemapClient initialization');
    });
  });

  describe('getRobots', () => {
    it('should return robots.txt data when available', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getRobots();

      expect(result).to.deep.equal(mockRawData.robots);
    });

    it('should return null when robots.txt is not available', async () => {
      const dataWithoutRobots = { ...mockRawData, robots: null };
      client._loadRawData = sandbox.stub().resolves(dataWithoutRobots);

      const result = await client.getRobots();

      expect(result).to.be.null;
    });

    it('should return null when URL is empty', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getByUrl('');

      expect(result).to.be.null;
    });

    it('should return null when URL is null', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getByUrl(null);

      expect(result).to.be.null;
    });
  });

  describe('getByUrl', () => {
    it('should return sitemap when found in sitemaps array', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getByUrl('https://example.com/sitemap.xml');

      expect(result).to.deep.equal(mockRawData.sitemaps[0]);
    });

    it('should return sitemap index when found in sitemap_index array', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getByUrl('https://example.com/sitemap-index.xml');

      expect(result).to.deep.equal(mockRawData.sitemap_index[0]);
    });

    it('should return null when URL is not found', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getByUrl('https://example.com/nonexistent.xml');

      expect(result).to.be.null;
    });
  });

  describe('getAllSitemaps', () => {
    it('should return all sitemaps', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getAllSitemaps();

      expect(result).to.deep.equal(mockRawData.sitemaps);
    });

    it('should return empty array when no sitemaps exist', async () => {
      const dataWithoutSitemaps = { ...mockRawData, sitemaps: undefined };
      client._loadRawData = sandbox.stub().resolves(dataWithoutSitemaps);

      const result = await client.getAllSitemaps();

      expect(result).to.deep.equal([]);
    });
  });

  describe('getAllIndeces', () => {
    it('should return all sitemap indices', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getAllIndeces();

      expect(result).to.deep.equal(mockRawData.sitemap_index);
    });

    it('should return empty array when no indices exist', async () => {
      const dataWithoutIndices = { ...mockRawData, sitemap_index: undefined };
      client._loadRawData = sandbox.stub().resolves(dataWithoutIndices);

      const result = await client.getAllIndeces();

      expect(result).to.deep.equal([]);
    });
  });

  describe('getSitemapUrls', () => {
    it('should return all sitemap URLs from both sitemaps and indices', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getSitemapUrls();

      expect(result).to.deep.equal([
        'https://example.com/sitemap.xml',
        'https://example.com/sitemap-index.xml',
      ]);
    });

    it('should return empty array when no sitemaps or indices exist', async () => {
      const emptyData = { sitemaps: undefined, sitemap_index: undefined };
      client._loadRawData = sandbox.stub().resolves(emptyData);

      const result = await client.getSitemapUrls();

      expect(result).to.deep.equal([]);
    });
  });

  describe('getSitemapChildren', () => {
    it('should return direct children of a sitemap', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapChildren('https://example.com/sitemap-index.xml');

      expect(result).to.deep.equal(mockHierarchicalData.sitemaps[0].children);
    });

    it('should return empty array when URL is empty', async () => {
      const result = await client.getSitemapChildren('');

      expect(result).to.deep.equal([]);
    });

    it('should return empty array when URL is null', async () => {
      const result = await client.getSitemapChildren(null);

      expect(result).to.deep.equal([]);
    });
  });

  describe('getSitemapParent', () => {
    it('should return parent of a sitemap', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapParent('https://example.com/sitemap.xml');

      expect(result).to.deep.equal(mockHierarchicalData.sitemaps[0]);
    });

    it('should return null when URL is empty', async () => {
      const result = await client.getSitemapParent('');

      expect(result).to.be.null;
    });

    it('should return null when URL is null', async () => {
      const result = await client.getSitemapParent(null);

      expect(result).to.be.null;
    });
  });

  describe('getAllUrls', () => {
    it('should return all URLs from flat data', async () => {
      client._loadFlatData = sandbox.stub().resolves(mockFlatData);

      const result = await client.getAllUrls();

      expect(result).to.deep.equal([
        'https://example.com/page1.html',
        'https://example.com/page2.html',
      ]);
    });

    it('should return empty array when no entries exist', async () => {
      const dataWithoutEntries = { entries: undefined };
      client._loadFlatData = sandbox.stub().resolves(dataWithoutEntries);

      const result = await client.getAllUrls();

      expect(result).to.deep.equal([]);
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries from flat data', async () => {
      client._loadFlatData = sandbox.stub().resolves(mockFlatData);

      const result = await client.getAllEntries();

      expect(result).to.deep.equal(mockFlatData.entries);
    });

    it('should return empty array when no entries exist', async () => {
      const dataWithoutEntries = { entries: undefined };
      client._loadFlatData = sandbox.stub().resolves(dataWithoutEntries);

      const result = await client.getAllEntries();

      expect(result).to.deep.equal([]);
    });
  });

  describe('getUrlMetadata', () => {
    it('should return metadata for existing URL', async () => {
      client._loadFlatData = sandbox.stub().resolves(mockFlatData);

      const result = await client.getUrlMetadata('https://example.com/page1.html');

      expect(result).to.deep.equal(mockFlatData.entries[0]);
    });

    it('should return null when URL is not found', async () => {
      client._loadFlatData = sandbox.stub().resolves(mockFlatData);

      const result = await client.getUrlMetadata('https://example.com/nonexistent.html');

      expect(result).to.be.null;
    });

    it('should return null when URL is empty', async () => {
      const result = await client.getUrlMetadata('');

      expect(result).to.be.null;
    });

    it('should return null when URL is null', async () => {
      const result = await client.getUrlMetadata(null);

      expect(result).to.be.null;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should return children of nested sitemap', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapChildren('https://example.com/sitemap.xml');

      expect(result).to.deep.equal(mockHierarchicalData.sitemaps[0].children[0].children);
    });

    it('should return parent of a nested URL', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapParent('https://example.com/page1.html');

      expect(result).to.deep.equal(mockHierarchicalData.sitemaps[0].children[0]);
    });

    it('should return null when sitemap is root level', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapParent('https://example.com/sitemap-index.xml');

      expect(result).to.be.null;
    });

    it('should return null when sitemap is not found', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapParent('https://example.com/nonexistent.xml');

      expect(result).to.be.null;
    });

    it('should return empty array when sitemap has no children', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapChildren('https://example.com/page1.html');

      expect(result).to.deep.equal([]);
    });

    it('should return empty array when sitemap is not found', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapChildren('https://example.com/nonexistent.xml');

      expect(result).to.deep.equal([]);
    });

    it('should return URLs from sitemaps only when indices are missing', async () => {
      const dataWithoutIndices = { ...mockRawData, sitemap_index: undefined };
      client._loadRawData = sandbox.stub().resolves(dataWithoutIndices);

      const result = await client.getSitemapUrls();

      expect(result).to.deep.equal(['https://example.com/sitemap.xml']);
    });

    it('should return URLs from indices only when sitemaps are missing', async () => {
      const dataWithoutSitemaps = { ...mockRawData, sitemaps: undefined };
      client._loadRawData = sandbox.stub().resolves(dataWithoutSitemaps);

      const result = await client.getSitemapUrls();

      expect(result).to.deep.equal(['https://example.com/sitemap-index.xml']);
    });
  });

  describe('Data Loading and Caching', () => {
    it('should handle data loading correctly', async () => {
      client._loadRawData = sandbox.stub().resolves(mockRawData);

      const result = await client.getRobots();
      expect(result).to.deep.equal(mockRawData.robots);
    });

    it('should handle hierarchical data loading correctly', async () => {
      client._loadHierarchicalData = sandbox.stub().resolves(mockHierarchicalData);

      const result = await client.getSitemapChildren('https://example.com/sitemap.xml');
      expect(result).to.deep.equal(mockHierarchicalData.sitemaps[0].children[0].children);
    });

    it('should handle flat data loading correctly', async () => {
      client._loadFlatData = sandbox.stub().resolves(mockFlatData);

      const result = await client.getAllUrls();
      expect(result).to.deep.equal(['https://example.com/page1.html', 'https://example.com/page2.html']);
    });
  });

  describe('Private methods testing', () => {
    it('should handle method calls correctly', () => {
      // Test that the client has the expected methods
      expect(client).to.have.property('getRobots');
      expect(client).to.have.property('getByUrl');
      expect(client).to.have.property('getAllSitemaps');
      expect(client).to.have.property('getAllIndeces');
      expect(client).to.have.property('getSitemapUrls');
      expect(client).to.have.property('getSitemapChildren');
      expect(client).to.have.property('getSitemapParent');
      expect(client).to.have.property('getAllUrls');
      expect(client).to.have.property('getAllEntries');
      expect(client).to.have.property('getUrlMetadata');
    });
  });
});
