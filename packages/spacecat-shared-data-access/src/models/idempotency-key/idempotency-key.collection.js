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

import { hasText, isValidUUID } from '@adobe/spacecat-shared-utils';

import { DataAccessError, ValidationError } from '../../errors/index.js';
import BaseCollection from '../base/base.collection.js';

/**
 * IdempotencyKeyCollection — manages IdempotencyKey entities.
 *
 * Auto-generated index query methods (via schema references):
 *   allByOrganizationId(organizationId) — all keys for an organization
 *
 * @class IdempotencyKeyCollection
 * @extends BaseCollection
 */
class IdempotencyKeyCollection extends BaseCollection {
  static COLLECTION_NAME = 'IdempotencyKeyCollection';

  /**
   * Finds a non-expired idempotency key by its value and organization.
   *
   * Returns null when:
   *   - No key exists with that value for the organization
   *   - The key exists but has expired (expires_at < NOW())
   *
   * @param {string} key - The idempotency key value.
   * @param {string} organizationId - The organization UUID.
   * @returns {Promise<import('./idempotency-key.model.js').default|null>}
   */
  async findActiveKey(key, organizationId) {
    if (!hasText(key)) {
      throw new ValidationError('key is required', this);
    }
    if (!isValidUUID(organizationId)) {
      throw new ValidationError('organizationId must be a valid UUID', this);
    }

    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .select()
      .eq('key', key)
      .eq('organization_id', organizationId)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (error) {
      throw new DataAccessError('Failed to find active idempotency key', { entityName: 'IdempotencyKey' }, error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return this.createInstanceFromRow(data[0]);
  }

  /**
   * Deletes all expired idempotency keys.
   * Called by the cleanup scheduler (every 5 minutes).
   *
   * @returns {Promise<number>} Number of expired keys deleted.
   */
  async deleteExpired() {
    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      throw new DataAccessError('Failed to delete expired idempotency keys', { entityName: 'IdempotencyKey' }, error);
    }

    return (data ?? []).length;
  }
}

export default IdempotencyKeyCollection;
