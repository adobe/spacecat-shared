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

import { getStoredMetrics } from '@adobe/spacecat-shared-utils';

/**
 * Sitemap Client for accessing website sitemap data with specific helper methods.
 */
export default class SitemapClient {
  /**
   * Creates a new SitemapClient instance
   * @param {string} siteId - The site ID
   * @param {Object} context - The universal context object
   */
  constructor(siteId, context) {
    if (!siteId) {
      throw new Error('siteId is required for SitemapClient initialization');
    }
    if (!context) {
      throw new Error('context is required for SitemapClient initialization');
    }

    this.siteId = siteId;
    this.context = context;
    this.log = context.log;
    this._rawData = null;
    this._hierarchicalData = null;
    this._flatData = null;
  }

  /**
   * Loads and caches the raw sitemap data
   * @returns {Promise<Object>} Raw sitemap data
   * @private
   */
  async _loadRawData() {
    if (this._rawData) {
      return this._rawData;
    }

    const config = {
      siteId: this.siteId,
      source: 'sitemap',
      metric: 'sitemap-raw',
    };

    try {
      this._rawData = await getStoredMetrics(config, this.context);
      this.log.info(`Successfully loaded raw sitemap data for site: ${this.siteId}`);
      return this._rawData;
    } catch (error) {
      this.log.error(`Failed to load raw sitemap data for site: ${this.siteId}, error: ${error.message}`);
      this._rawData = { robots: null, sitemaps: [], sitemap_index: [] };
      return this._rawData;
    }
  }

  /**
   * Loads and caches the hierarchical sitemap data
   * @returns {Promise<Object>} Hierarchical sitemap data
   * @private
   */
  async _loadHierarchicalData() {
    if (this._hierarchicalData) {
      return this._hierarchicalData;
    }

    const config = {
      siteId: this.siteId,
      source: 'sitemap',
      metric: 'sitemap-hierarchical',
    };

    try {
      this._hierarchicalData = await getStoredMetrics(config, this.context);
      this.log.info(`Successfully loaded hierarchical sitemap data for site: ${this.siteId}`);
      return this._hierarchicalData;
    } catch (error) {
      this.log.error(`Failed to load hierarchical sitemap data for site: ${this.siteId}, error: ${error.message}`);
      this._hierarchicalData = { root: '', sitemaps: [] };
      return this._hierarchicalData;
    }
  }

  /**
   * Loads and caches the flat sitemap data
   * @returns {Promise<Object>} Flat sitemap data
   * @private
   */
  async _loadFlatData() {
    if (this._flatData) {
      return this._flatData;
    }

    const config = {
      siteId: this.siteId,
      source: 'sitemap',
      metric: 'sitemap-flat',
    };

    try {
      this._flatData = await getStoredMetrics(config, this.context);
      this.log.info(`Successfully loaded flat sitemap data for site: ${this.siteId}`);
      return this._flatData;
    } catch (error) {
      this.log.error(`Failed to load flat sitemap data for site: ${this.siteId}, error: ${error.message}`);
      this._flatData = { entries: [] };
      return this._flatData;
    }
  }

  /**
   * Gets the robots.txt data
   * @returns {Promise<Object|null>} Robots.txt data with url and content, or null if not available
   */
  async getRobots() {
    const data = await this._loadRawData();
    return data.robots || null;
  }

  /**
   * Gets a sitemap or sitemap index by URL
   * @param {string} url - The URL to search for
   * @returns {Promise<Object|null>} The sitemap/index object or null if not found
   */
  async getByUrl(url) {
    if (!url) {
      return null;
    }

    const data = await this._loadRawData();

    const sitemap = data.sitemaps?.find((s) => s.url === url);
    if (sitemap) {
      return sitemap;
    }

    const sitemapIndex = data.sitemap_index?.find((s) => s.url === url);
    if (sitemapIndex) {
      return sitemapIndex;
    }

    return null;
  }

  /**
   * Gets all sitemaps (urlset type)
   * @returns {Promise<Array>} Array of sitemap objects
   */
  async getAllSitemaps() {
    const data = await this._loadRawData();
    return data.sitemaps || [];
  }

  /**
   * Gets all sitemap indices (sitemapindex type)
   * @returns {Promise<Array>} Array of sitemap index objects
   */
  async getAllIndeces() {
    const data = await this._loadRawData();
    return data.sitemap_index || [];
  }

  /**
   * Gets all sitemap URLs (from both sitemaps and indices)
   * @returns {Promise<Array>} Array of all sitemap URLs
   */
  async getSitemapUrls() {
    const data = await this._loadRawData();
    const urls = [];

    // Add URLs from sitemaps
    if (data.sitemaps) {
      urls.push(...data.sitemaps.map((s) => s.url));
    }

    // Add URLs from sitemap indices
    if (data.sitemap_index) {
      urls.push(...data.sitemap_index.map((s) => s.url));
    }

    return urls;
  }

  /**
   * Gets the direct children of a sitemap in the hierarchical structure
   * @param {string} url - The sitemap URL to find children for
   * @returns {Promise<Array>} Array of child sitemap objects, or empty array if not found
   */
  async getSitemapChildren(url) {
    if (!url) {
      return [];
    }

    const data = await this._loadHierarchicalData();

    const findSitemap = (sitemaps) => {
      for (const sitemap of sitemaps) {
        if (sitemap.url === url) {
          return sitemap.children || [];
        }
        if (sitemap.children) {
          const result = findSitemap(sitemap.children);
          if (result.length > 0) {
            return result;
          }
        }
      }
      return [];
    };

    return findSitemap(data.sitemaps);
  }

  /**
   * Gets the parent of a sitemap in the hierarchical structure
   * @param {string} url - The sitemap URL to find parent for
   * @returns {Promise<Object|null>} Parent sitemap object, or null if not found or is root
   */
  async getSitemapParent(url) {
    if (!url) {
      return null;
    }

    const data = await this._loadHierarchicalData();

    const findParent = (sitemaps) => {
      for (const sitemap of sitemaps) {
        if (sitemap.children) {
          for (const child of sitemap.children) {
            if (child.url === url) {
              return sitemap;
            }
          }
          const result = findParent(sitemap.children);
          if (result) {
            return result;
          }
        }
      }
      return null;
    };

    return findParent(data.sitemaps);
  }

  /**
   * Gets all page URLs from the flat sitemap data
   * @returns {Promise<Array<string>>} Array of all page URLs
   */
  async getAllUrls() {
    const data = await this._loadFlatData();
    return data.entries?.map((entry) => entry.url) || [];
  }

  /**
   * Gets all URL entries with full metadata from the flat sitemap data
   * @returns {Promise<Array>} Array of all URL entries with metadata
   */
  async getAllEntries() {
    const data = await this._loadFlatData();
    return data.entries || [];
  }

  /**
   * Gets metadata for a specific URL from the flat sitemap data
   * @param {string} url - The URL to get metadata for
   * @returns {Promise<Object|null>} URL metadata object, or null if not found
   */
  async getUrlMetadata(url) {
    if (!url) {
      return null;
    }

    const data = await this._loadFlatData();
    const entry = data.entries?.find((e) => e.url === url);
    return entry || null;
  }
}
