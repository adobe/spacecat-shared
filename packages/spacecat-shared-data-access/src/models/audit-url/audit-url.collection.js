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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';

/**
 * AuditUrlCollection - A collection class responsible for managing AuditUrl entities.
 * Extends the BaseCollection to provide specific methods for interacting with AuditUrl records.
 *
 * @class AuditUrlCollection
 * @extends BaseCollection
 */
class AuditUrlCollection extends BaseCollection {
  static COLLECTION_NAME = 'AuditUrlCollection';

  /**
   * Sorts audit URLs by a specified field.
   * @param {Array} auditUrls - Array of AuditUrl objects to sort.
   * @param {string} sortBy - Field to sort by ('url', 'createdAt', 'updatedAt').
   * @param {string} sortOrder - Sort order ('asc' or 'desc'). Default: 'asc'.
   * @returns {Array} Sorted array of AuditUrl objects.
   * @private
   */
  static sortAuditUrls(auditUrls, sortBy = 'createdAt', sortOrder = 'asc') {
    if (!auditUrls || auditUrls.length === 0) {
      return auditUrls;
    }

    const sorted = [...auditUrls].sort((a, b) => {
      let aValue;
      let bValue;

      // Get values using getter methods if available (with optional chaining)
      switch (sortBy) {
        case 'url':
          aValue = a.getUrl?.() ?? a.url;
          bValue = b.getUrl?.() ?? b.url;
          break;
        case 'createdAt':
          aValue = a.getCreatedAt?.() ?? a.createdAt;
          bValue = b.getCreatedAt?.() ?? b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.getUpdatedAt?.() ?? a.updatedAt;
          bValue = b.getUpdatedAt?.() ?? b.updatedAt;
          break;
        default:
          return 0;
      }

      // Handle null/undefined values (push to end)
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
        /* c8 ignore start */
        // Defensive: all current sort fields return strings,
        // but keep numeric comparison for future extensibility
      } else if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      } else {
        comparison = 0;
      }
      /* c8 ignore stop */

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Finds an audit URL by its composite primary key (siteId + url).
   * This is the primary lookup method, similar to LatestAudit.findById(siteId, auditType).
   *
   * @param {string} siteId - The site ID (partition key).
   * @param {string} url - The URL (sort key).
   * @returns {Promise<AuditUrl|null>} The found AuditUrl or null.
   */
  async findById(siteId, url) {
    if (!hasText(siteId) || !hasText(url)) {
      throw new Error('Both siteId and url are required');
    }

    return this.findByIndexKeys({ siteId, url });
  }

  /**
   * Convenience alias for findById.
   * @param {string} siteId - The site ID (partition key).
   * @param {string} url - The URL (sort key).
   * @returns {Promise<AuditUrl|null>} The found AuditUrl or null.
   */
  async findBySiteIdAndUrl(siteId, url) {
    return this.findById(siteId, url);
  }

  /**
   * Gets all audit URLs for a site that have a specific audit type enabled.
   * Uses DynamoDB FilterExpression to filter at the database level.
   *
   * @param {string} siteId - The site ID.
   * @param {string} auditType - The audit type to filter by.
   * @param {object} [options={}] - Query options (limit, cursor, sortBy, sortOrder).
   * @returns {Promise<{data: AuditUrl[], cursor: string|null}>} Paginated results.
   */
  async allBySiteIdAndAuditType(siteId, auditType, options = {}) {
    if (!hasText(siteId) || !hasText(auditType)) {
      throw new Error('Both siteId and auditType are required');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    // Use FilterExpression to filter at DynamoDB level (reduces network transfer)
    const result = await this.allByIndexKeys(
      { siteId },
      {
        ...queryOptions,
        returnCursor: true,
        where: (attr, op) => op.contains(attr.audits, auditType),
      },
    );

    // Handle result format
    const data = result.data || [];
    const { cursor } = result;

    // Apply sorting if requested
    const sortedData = sortBy
      ? AuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  /**
   * Gets all audit URLs for a site with sorting support.
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor, sortBy, sortOrder).
   * @returns {Promise<{data: AuditUrl[], cursor: string|null}>} Paginated and sorted results.
   */
  async allBySiteIdSorted(siteId, options = {}) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    // Get all URLs for the site with pagination metadata
    const result = await this.allByIndexKeys(
      { siteId },
      { ...queryOptions, returnCursor: true },
    );

    // Handle result format
    const data = result.data || [];
    const { cursor } = result;

    // Apply sorting if requested
    const sortedData = sortBy
      ? AuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  /**
   * Gets all audit URLs for a site by byCustomer flag with sorting support.
   * Uses GSI (spacecat-data-gsi2pk-gsi2sk) for efficient querying.
   * @param {string} siteId - The site ID.
   * @param {boolean} byCustomer - True for customer-added, false for system-added.
   * @param {object} [options={}] - Query options (limit, cursor, sortBy, sortOrder).
   * @returns {Promise<{data: AuditUrl[], cursor: string|null}>} Paginated and sorted results.
   */
  async allBySiteIdByCustomerSorted(siteId, byCustomer, options = {}) {
    if (!hasText(siteId) || typeof byCustomer !== 'boolean') {
      throw new Error('SiteId is required and byCustomer must be a boolean');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    // Use GSI for efficient querying by siteId + byCustomer with pagination metadata
    const result = await this.allByIndexKeys(
      { siteId, byCustomer },
      {
        ...queryOptions,
        returnCursor: true,
        index: 'spacecat-data-gsi2pk-gsi2sk',
      },
    );

    // Handle result format
    const data = result.data || [];
    const { cursor } = result;

    // Apply sorting if requested
    const sortedData = sortBy
      ? AuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  /**
   * Removes all audit URLs for a specific site.
   * Useful for cleanup operations.
   *
   * @param {string} siteId - The site ID.
   * @returns {Promise<void>}
   */
  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const urlsToRemove = await this.allBySiteId(siteId);

    if (urlsToRemove.length > 0) {
      // Use composite keys (siteId + url) for deletion
      const keysToRemove = urlsToRemove.map((auditUrl) => ({
        siteId,
        url: auditUrl.getUrl?.() ?? auditUrl.url,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }

  /**
   * Removes audit URLs by byCustomer flag for a specific site.
   * For example, remove all customer-added or all system-added URLs.
   * Uses GSI (spacecat-data-gsi2pk-gsi2sk) for efficient querying.
   *
   * @param {string} siteId - The site ID.
   * @param {boolean} byCustomer - True for customer-added, false for system-added.
   * @returns {Promise<void>}
   */
  async removeForSiteIdByCustomer(siteId, byCustomer) {
    if (!hasText(siteId) || typeof byCustomer !== 'boolean') {
      throw new Error('SiteId is required and byCustomer must be a boolean');
    }

    // Use GSI for efficient querying by siteId + byCustomer
    const urlsToRemove = await this.allByIndexKeys(
      { siteId, byCustomer },
      { index: 'spacecat-data-gsi2pk-gsi2sk' },
    );

    if (urlsToRemove.length > 0) {
      // Use composite keys (siteId + url) for deletion
      const keysToRemove = urlsToRemove.map((auditUrl) => ({
        siteId,
        url: auditUrl.getUrl?.() ?? auditUrl.url,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default AuditUrlCollection;
