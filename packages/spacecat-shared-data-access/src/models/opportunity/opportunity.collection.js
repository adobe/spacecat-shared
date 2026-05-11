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

import { ValidationError } from '../../errors/index.js';
import BaseCollection from '../base/base.collection.js';

/**
 * OpportunityCollection - A collection class responsible for managing Opportunity entities.
 * Extends the BaseCollection to provide specific methods for interacting with Opportunity records.
 *
 * @class OpportunityCollection
 * @extends BaseCollection
 */
class OpportunityCollection extends BaseCollection {
  static COLLECTION_NAME = 'OpportunityCollection';

  /**
   * Validates and creates a new Opportunity. Enforces that scopeType and scopeId
   * must both be present or both be absent — a half-scoped record is invalid.
   *
   * @param {object} item - The opportunity data.
   * @param {object} [options] - Optional create options (e.g. { upsert: true }).
   * @returns {Promise<Opportunity>} The created opportunity instance.
   */
  async create(item, options) {
    const { scopeType, scopeId } = item || {};
    if (hasText(scopeType) !== hasText(scopeId)) {
      throw new ValidationError('scopeType and scopeId must both be set or both be absent', this);
    }
    return super.create(item, options);
  }

  /**
   * Validates and bulk-creates Opportunities. Enforces the scopeType/scopeId
   * co-presence invariant on every item — half-scoped records are invalid.
   *
   * Overrides BaseCollection.createMany() which would otherwise bypass the
   * single-item create() guard and persist invalid scope tuples directly.
   *
   * @param {object[]} items - The opportunity items to create.
   * @param {...*} rest - Additional arguments forwarded to BaseCollection.createMany.
   * @returns {Promise<*>} The result from BaseCollection.createMany.
   */
  async createMany(items, ...rest) {
    if (Array.isArray(items)) {
      for (const item of items) {
        const { scopeType, scopeId } = item || {};
        if (hasText(scopeType) !== hasText(scopeId)) {
          throw new ValidationError('scopeType and scopeId must both be set or both be absent', this);
        }
      }
    }
    return super.createMany(items, ...rest);
  }

  /**
   * Validates and updates an Opportunity by its keys. Enforces the scopeType/scopeId
   * co-presence invariant: if either field appears in the update payload, both must
   * be set or both must be absent — a half-scoped update is invalid.
   *
   * Note: this guard enforces co-presence but allows scope re-attribution
   * (moving an opportunity from one scopeId to another within the same scopeType).
   * scopeId is the tenant boundary; callers must verify authorization before mutating it.
   *
   * @param {object} keys - The key attributes identifying the record.
   * @param {object} updates - The fields to update.
   * @returns {Promise<void>}
   */
  async updateByKeys(keys, updates) {
    const hasScopeType = updates != null && 'scopeType' in updates;
    const hasScopeId = updates != null && 'scopeId' in updates;
    // If either field is included in the update, both must be included together,
    // and their combined values must satisfy co-presence (both set or both absent).
    if (hasScopeType !== hasScopeId) {
      throw new ValidationError('scopeType and scopeId must both be set or both be absent', this);
    }
    if (hasScopeType && hasScopeId) {
      const { scopeType, scopeId } = updates;
      if (hasText(scopeType) !== hasText(scopeId)) {
        throw new ValidationError('scopeType and scopeId must both be set or both be absent', this);
      }
    }
    return super.updateByKeys(keys, updates);
  }

  /**
   * Returns all opportunities matching a given scope type and scope ID.
   *
   * @param {string} scopeType - The scope type (e.g. 'brand').
   * @param {string} scopeId - The scope entity UUID.
   * @returns {Promise<Opportunity[]>} The matching opportunities.
   */
  async allByScope(scopeType, scopeId) {
    if (!hasText(scopeType)) {
      throw new Error('allByScope: scopeType is required');
    }
    if (!hasText(scopeId)) {
      throw new Error('allByScope: scopeId is required');
    }
    return this.allByIndexKeys({ scopeType, scopeId });
  }
}

export default OpportunityCollection;
