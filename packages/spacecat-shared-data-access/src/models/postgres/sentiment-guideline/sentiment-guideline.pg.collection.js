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

class PostgresSentimentGuidelineCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'SentimentGuidelineCollection';

  async findById(siteId, guidelineId) {
    if (!hasText(siteId) || !hasText(guidelineId)) {
      throw new Error('Both siteId and guidelineId are required');
    }

    return this.findByIndexKeys({ siteId, guidelineId });
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

  async allBySiteIdAndAuditType(siteId, auditType, options = {}) {
    if (!hasText(siteId) || !hasText(auditType)) {
      throw new Error('Both siteId and auditType are required');
    }

    const result = await this.allByIndexKeys(
      { siteId },
      {
        ...options,
        returnCursor: true,
        where: (attr, op) => op.contains(attr.audits, auditType),
      },
    );

    return {
      data: result.data || [],
      cursor: result.cursor,
    };
  }

  async findByIds(siteId, guidelineIds) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!Array.isArray(guidelineIds) || guidelineIds.length === 0) {
      return [];
    }

    const result = await this.allBySiteId(siteId);
    const allGuidelines = result.data || [];
    const guidelineIdSet = new Set(guidelineIds);

    return allGuidelines.filter((guideline) => {
      const id = guideline.getGuidelineId?.() ?? guideline.guidelineId;
      return guidelineIdSet.has(id);
    });
  }

  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const result = await this.allBySiteId(siteId);
    const guidelinesToRemove = result.data || [];

    if (guidelinesToRemove.length > 0) {
      const keysToRemove = guidelinesToRemove.map((guideline) => ({
        siteId,
        guidelineId: guideline.getGuidelineId?.() ?? guideline.guidelineId,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default PostgresSentimentGuidelineCollection;
