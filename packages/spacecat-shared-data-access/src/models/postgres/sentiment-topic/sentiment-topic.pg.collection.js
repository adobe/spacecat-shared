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

import PostgresBaseCollection from '../base/postgres-base.collection.js';
import PostgresSentimentTopicModel from './sentiment-topic.pg.model.js';

class PostgresSentimentTopicCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'SentimentTopicCollection';

  static MODEL_CLASS = PostgresSentimentTopicModel;

  async findById(siteId, topicId) {
    if (!hasText(siteId) || !hasText(topicId)) {
      throw new Error('Both siteId and topicId are required');
    }

    return this.findByIndexKeys({ siteId, topicId });
  }

  async allBySiteId(siteId, options = {}) {
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

  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const result = await this.allBySiteId(siteId);
    const topicsToRemove = result.data || [];

    if (topicsToRemove.length > 0) {
      const keysToRemove = topicsToRemove.map((topic) => ({
        siteId,
        topicId: topic.getTopicId?.() ?? topic.topicId,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default PostgresSentimentTopicCollection;
