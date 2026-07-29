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

import { isValidUUID } from '@adobe/spacecat-shared-utils';

import { ValidationError } from '../../errors/index.js';
import BaseCollection from '../base/base.collection.js';
import TaskManagementConnection from './task-management-connection.model.js';

/**
 * TaskManagementConnectionCollection — manages TaskManagementConnection entities.
 *
 * Key query the ticket-creation API relies on:
 *   `findActiveByOrganizationAndProvider(orgId, provider)` — returns the single
 *   active connection for a given org + provider pair, or null if none exists.
 *
 * @class TaskManagementConnectionCollection
 * @extends BaseCollection
 */
class TaskManagementConnectionCollection extends BaseCollection {
  static COLLECTION_NAME = 'TaskManagementConnectionCollection';

  /**
   * Returns the single active connection for an organization and provider, or
   * null when the org has not connected that provider (or the connection is
   * in a degraded / disconnected state).
   *
   * The API layer calls this before every ticket-creation request and returns
   * 409 Conflict when no active connection is found.
   *
   * @param {string} organizationId - The organization UUID.
   * @param {string} provider - The provider key, e.g. 'jira_cloud'.
   * @returns {Promise<TaskManagementConnection|null>}
   * @throws {ValidationError} When organizationId or provider is missing.
   */
  async findActiveByOrganizationAndProvider(organizationId, provider) {
    if (!isValidUUID(organizationId)) {
      throw new ValidationError('organizationId must be a valid UUID', this);
    }
    if (!provider) {
      throw new ValidationError('provider is required', this);
    }

    return this.findByOrganizationIdAndProviderAndStatus(
      organizationId,
      provider,
      TaskManagementConnection.STATUSES.ACTIVE,
    );
  }
}

export default TaskManagementConnectionCollection;
