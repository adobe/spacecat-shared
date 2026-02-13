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

import { isNonEmptyArray } from '@adobe/spacecat-shared-utils';

import DataAccessError from '../../../errors/data-access.error.js';
import { guardId, guardString } from '../../../util/guards.js';
import PostgresBaseCollection from '../base/postgres-base.collection.js';

/**
 * PostgresLatestAuditCollection - A Postgres-backed collection for LatestAudit entities.
 * LatestAudit is a VIRTUAL entity in v3 - there is no separate latest_audits table.
 * All queries delegate to the AuditCollection and group/filter to find the newest
 * audit per site+auditType combination.
 *
 * @class PostgresLatestAuditCollection
 * @extends PostgresBaseCollection
 */
class PostgresLatestAuditCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'LatestAuditCollection';

  // LatestAudit is a virtual view in v3; writes are not supported.
  // eslint-disable-next-line class-methods-use-this
  async create() {
    throw new DataAccessError('LatestAudit is derived from Audit in v3 and cannot be created directly', this);
  }

  // eslint-disable-next-line class-methods-use-this
  async createMany() {
    throw new DataAccessError('LatestAudit is derived from Audit in v3 and cannot be created directly', this);
  }

  /**
   * Groups audit records by a set of fields and keeps only the newest per group.
   * @param {Array} items - Array of audit model instances.
   * @param {string[]} groupFields - Fields to group by.
   * @returns {Array} One audit per group (the newest by auditedAt).
   */
  static #groupLatest(items, groupFields) {
    const grouped = new Map();
    items.forEach((item) => {
      const key = groupFields.map((field) => item.record[field]).join('#');
      const existing = grouped.get(key);
      if (!existing || existing.getAuditedAt() < item.getAuditedAt()) {
        grouped.set(key, item);
      }
    });
    return [...grouped.values()];
  }

  /**
   * Fetches all audits matching the given keys from the Audit collection.
   * @param {Object} keys - Index keys to filter by.
   * @param {Object} [options={}] - Query options.
   * @returns {Promise<Array>} Array of audit model instances.
   */
  async #allAuditsByKeys(keys, options = {}) {
    const auditCollection = this.entityRegistry.getCollection('AuditCollection');
    return auditCollection.allByIndexKeys(keys, {
      ...options,
      fetchAllPages: true,
      order: 'desc',
      returnCursor: false,
    });
  }

  async all(sortKeys = {}, options = {}) {
    return this.allByIndexKeys(sortKeys, options);
  }

  async findByAll(sortKeys = {}, options = {}) {
    return this.findByIndexKeys(sortKeys, options);
  }

  async findByIndexKeys(keys, options = {}) {
    const auditCollection = this.entityRegistry.getCollection('AuditCollection');

    // Fast path: if both siteId and auditType are specified, just get the newest one
    if (keys.siteId && keys.auditType) {
      return auditCollection.findByIndexKeys(keys, { ...options, order: 'desc' });
    }

    const audits = await this.#allAuditsByKeys(keys, options);
    if (!isNonEmptyArray(audits)) {
      return null;
    }

    const groupFields = keys.siteId ? ['auditType'] : ['siteId', 'auditType'];
    const latest = PostgresLatestAuditCollection.#groupLatest(audits, groupFields);
    return latest[0] || null;
  }

  async allByIndexKeys(keys, options = {}) {
    const audits = await this.#allAuditsByKeys(keys, options);
    if (!isNonEmptyArray(audits)) {
      return options.returnCursor ? { data: [], cursor: null } : [];
    }

    let groupFields = ['siteId', 'auditType'];
    if (keys.siteId && !keys.auditType) {
      groupFields = ['auditType'];
    } else if (!keys.siteId && keys.auditType) {
      groupFields = ['siteId'];
    }

    const latest = PostgresLatestAuditCollection.#groupLatest(audits, groupFields);
    const limited = Number.isInteger(options.limit) ? latest.slice(0, options.limit) : latest;

    return options.returnCursor ? { data: limited, cursor: null } : limited;
  }

  async allByAuditType(auditType) {
    guardString('auditType', auditType, this.entityName);

    return this.all({ auditType });
  }

  async findById(siteId, auditType) {
    guardId('siteId', siteId, this.entityName);
    guardString('auditType', auditType, this.entityName);

    return this.findByIndexKeys({ siteId, auditType });
  }
}

export default PostgresLatestAuditCollection;
