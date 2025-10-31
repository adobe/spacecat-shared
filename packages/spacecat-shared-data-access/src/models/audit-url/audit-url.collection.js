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
  /**
   * Finds an audit URL by site ID and URL.
   * This is a convenience method for looking up a specific URL.
   *
   * @param {string} siteId - The site ID.
   * @param {string} url - The URL to find.
   * @returns {Promise<AuditUrl|null>} The found AuditUrl or null.
   */
  async findBySiteIdAndUrl(siteId, url) {
    if (!hasText(siteId) || !hasText(url)) {
      throw new Error('Both siteId and url are required');
    }

    const results = await this.allBySiteIdAndUrl(siteId, url);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Gets all audit URLs for a site that have a specific audit type enabled.
   * Note: This performs filtering after retrieval since audits is an array.
   *
   * @param {string} siteId - The site ID.
   * @param {string} auditType - The audit type to filter by.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{items: AuditUrl[], cursor?: string}>} Paginated results.
   */
  async allBySiteIdAndAuditType(siteId, auditType, options = {}) {
    if (!hasText(siteId) || !hasText(auditType)) {
      throw new Error('Both siteId and auditType are required');
    }

    // Get all URLs for the site
    const allUrls = await this.allBySiteId(siteId, options);

    // Filter by audit type
    const filtered = allUrls.filter((auditUrl) => auditUrl.isAuditEnabled(auditType));

    return filtered;
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
    const idsToRemove = urlsToRemove.map((auditUrl) => auditUrl.getId());

    if (idsToRemove.length > 0) {
      await this.removeByIds(idsToRemove);
    }
  }

  /**
   * Removes audit URLs by source for a specific site.
   * For example, remove all 'sitemap' sourced URLs.
   *
   * @param {string} siteId - The site ID.
   * @param {string} source - The source to filter by.
   * @returns {Promise<void>}
   */
  async removeForSiteIdAndSource(siteId, source) {
    if (!hasText(siteId) || !hasText(source)) {
      throw new Error('Both siteId and source are required');
    }

    const urlsToRemove = await this.allBySiteIdAndSource(siteId, source);
    const idsToRemove = urlsToRemove.map((auditUrl) => auditUrl.getId());

    if (idsToRemove.length > 0) {
      await this.removeByIds(idsToRemove);
    }
  }
}

export default AuditUrlCollection;

