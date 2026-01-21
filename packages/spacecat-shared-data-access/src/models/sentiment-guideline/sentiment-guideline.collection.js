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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';

/**
 * SentimentGuidelineCollection - A collection class for managing SentimentGuideline entities.
 * Extends BaseCollection to provide specific methods for sentiment guidelines.
 *
 * @class SentimentGuidelineCollection
 * @extends BaseCollection
 */
class SentimentGuidelineCollection extends BaseCollection {
  static COLLECTION_NAME = 'SentimentGuidelineCollection';

  /**
   * Finds a sentiment guideline by its composite primary key (siteId + guidelineId).
   *
   * @param {string} siteId - The site ID (partition key).
   * @param {string} guidelineId - The guideline ID (sort key).
   * @returns {Promise<SentimentGuideline|null>} The found SentimentGuideline or null.
   */
  async findById(siteId, guidelineId) {
    if (!hasText(siteId) || !hasText(guidelineId)) {
      throw new Error('Both siteId and guidelineId are required');
    }

    return this.findByIndexKeys({ siteId, guidelineId });
  }

  /**
   * Gets all sentiment guidelines for a site.
   *
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{data: SentimentGuideline[], cursor: string|null}>} Paginated results.
   */
  async allBySiteIdPaginated(siteId, options = {}) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const result = await this.allByIndexKeys(
      { siteId },
      { ...options, returnCursor: true },
    );

    return {
      data: result.data || [],
      cursor: result.cursor,
    };
  }

  /**
   * Gets all enabled sentiment guidelines for a site.
   *
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{data: SentimentGuideline[], cursor: string|null}>} Paginated results.
   */
  async allBySiteIdEnabled(siteId, options = {}) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const result = await this.allByIndexKeys(
      { siteId },
      {
        ...options,
        returnCursor: true,
        where: (attr, op) => op.eq(attr.enabled, true),
      },
    );

    return {
      data: result.data || [],
      cursor: result.cursor,
    };
  }

  /**
   * Finds multiple guidelines by their IDs using batch get.
   * Useful for resolving guidelineIds from a SentimentTopic.
   *
   * @param {string} siteId - The site ID.
   * @param {string[]} guidelineIds - Array of guideline IDs to fetch.
   * @returns {Promise<SentimentGuideline[]>} Array of found guidelines.
   */
  async findByIds(siteId, guidelineIds) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!Array.isArray(guidelineIds) || guidelineIds.length === 0) {
      return [];
    }

    // Fetch all guidelines for the site and filter
    // Note: For large datasets, consider implementing batch get
    const allGuidelines = await this.allBySiteId(siteId);
    const guidelineIdSet = new Set(guidelineIds);

    return allGuidelines.filter((guideline) => {
      const id = guideline.getGuidelineId?.() ?? guideline.guidelineId;
      return guidelineIdSet.has(id);
    });
  }

  /**
   * Removes all sentiment guidelines for a specific site.
   *
   * @param {string} siteId - The site ID.
   * @returns {Promise<void>}
   */
  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const guidelinesToRemove = await this.allBySiteId(siteId);

    if (guidelinesToRemove.length > 0) {
      const keysToRemove = guidelinesToRemove.map((guideline) => ({
        siteId,
        guidelineId: guideline.getGuidelineId?.() ?? guideline.guidelineId,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default SentimentGuidelineCollection;
