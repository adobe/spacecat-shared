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
import PostgresAuditUrlModel from './audit-url.pg.model.js';

class PostgresAuditUrlCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'AuditUrlCollection';

  static MODEL_CLASS = PostgresAuditUrlModel;

  static sortAuditUrls(auditUrls, sortBy = 'createdAt', sortOrder = 'asc') {
    if (!auditUrls || auditUrls.length === 0) {
      return auditUrls;
    }

    const sorted = [...auditUrls].sort((a, b) => {
      let aValue;
      let bValue;

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

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  async findById(siteId, url) {
    if (!hasText(siteId) || !hasText(url)) {
      throw new Error('Both siteId and url are required');
    }

    return this.findByIndexKeys({ siteId, url });
  }

  async findBySiteIdAndUrl(siteId, url) {
    return this.findById(siteId, url);
  }

  async allBySiteIdAndAuditType(siteId, auditType, options = {}) {
    if (!hasText(siteId) || !hasText(auditType)) {
      throw new Error('Both siteId and auditType are required');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    const result = await this.allByIndexKeys(
      { siteId },
      {
        ...queryOptions,
        returnCursor: true,
        where: (attr, op) => op.contains(attr.audits, auditType),
      },
    );

    const data = result.data || [];
    const { cursor } = result;

    const sortedData = sortBy
      ? PostgresAuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  async allBySiteIdSorted(siteId, options = {}) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    const result = await this.allByIndexKeys(
      { siteId },
      { ...queryOptions, returnCursor: true },
    );

    const data = result.data || [];
    const { cursor } = result;

    const sortedData = sortBy
      ? PostgresAuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  async allBySiteIdByCustomerSorted(siteId, byCustomer, options = {}) {
    if (!hasText(siteId) || typeof byCustomer !== 'boolean') {
      throw new Error('SiteId is required and byCustomer must be a boolean');
    }

    const { sortBy, sortOrder, ...queryOptions } = options;

    const result = await this.allByIndexKeys(
      { siteId, byCustomer },
      {
        ...queryOptions,
        returnCursor: true,
        index: 'spacecat-data-gsi2pk-gsi2sk',
      },
    );

    const data = result.data || [];
    const { cursor } = result;

    const sortedData = sortBy
      ? PostgresAuditUrlCollection.sortAuditUrls(data, sortBy, sortOrder)
      : data;

    return {
      data: sortedData,
      cursor,
    };
  }

  async removeForSiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const urlsToRemove = await this.allBySiteId(siteId);

    if (urlsToRemove.length > 0) {
      const keysToRemove = urlsToRemove.map((auditUrl) => ({
        siteId,
        url: auditUrl.getUrl?.() ?? auditUrl.url,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }

  async removeForSiteIdByCustomer(siteId, byCustomer) {
    if (!hasText(siteId) || typeof byCustomer !== 'boolean') {
      throw new Error('SiteId is required and byCustomer must be a boolean');
    }

    const urlsToRemove = await this.allByIndexKeys(
      { siteId, byCustomer },
      { index: 'spacecat-data-gsi2pk-gsi2sk' },
    );

    if (urlsToRemove.length > 0) {
      const keysToRemove = urlsToRemove.map((auditUrl) => ({
        siteId,
        url: auditUrl.getUrl?.() ?? auditUrl.url,
      }));
      await this.removeByIndexKeys(keysToRemove);
    }
  }
}

export default PostgresAuditUrlCollection;
