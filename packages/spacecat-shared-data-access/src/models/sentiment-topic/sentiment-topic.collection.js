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
 * SentimentTopicCollection - A collection class for managing SentimentTopic entities.
 * Extends BaseCollection to provide specific methods for sentiment topics.
 *
 * @class SentimentTopicCollection
 * @extends BaseCollection
 */
class SentimentTopicCollection extends BaseCollection {
  static COLLECTION_NAME = 'SentimentTopicCollection';

  /**
   * Finds a sentiment topic by its composite primary key (siteId + topicId).
   *
   * @param {string} siteId - The site ID (partition key).
   * @param {string} topicId - The topic ID (sort key).
   * @returns {Promise<SentimentTopic|null>} The found SentimentTopic or null.
   */
  async findById(siteId, topicId) {
    if (!hasText(siteId) || !hasText(topicId)) {
      throw new Error('Both siteId and topicId are required');
    }

    return this.findByIndexKeys({ siteId, topicId });
  }

  /**
   * Gets all sentiment topics for a site.
   *
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{data: SentimentTopic[], cursor: string|null}>} Paginated results.
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
   * Gets all enabled sentiment topics for a site.
   *
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{data: SentimentTopic[], cursor: string|null}>} Paginated results.
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
   * Removes all sentiment topics for a specific site.
   *
   * @param {string} siteId - The site ID.
   * @returns {Promise<void>}
   */
  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const topicsToRemove = await this.allBySiteId(siteId);

    if (topicsToRemove.length > 0) {
      const keysToRemove = topicsToRemove.map((topic) => ({
        siteId,
        topicId: topic.getTopicId?.() ?? topic.topicId,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default SentimentTopicCollection;
