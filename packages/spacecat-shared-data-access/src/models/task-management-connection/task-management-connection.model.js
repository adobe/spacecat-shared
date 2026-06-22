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

import BaseModel from '../base/base.model.js';

/**
 * TaskManagementConnection — one OAuth connection from an organization to a
 * task-management provider (e.g. Jira Cloud).
 *
 * Status lifecycle:
 *   active           → tokens are valid, tickets can be created
 *   requires_reauth  → refresh token expired, user must reconnect
 *   disconnected     → explicitly disconnected by the user
 *
 * Provider-specific config (cloudId, siteUrl, scopeKey) lives in `metadata`
 * as jsonb so new fields never require a schema change.
 *
 * @class TaskManagementConnection
 * @extends BaseModel
 */
class TaskManagementConnection extends BaseModel {
  static ENTITY_NAME = 'TaskManagementConnection';

  /** Supported task-management providers. */
  static PROVIDERS = {
    JIRA_CLOUD: 'jira_cloud',
  };

  /**
   * Connection health statuses.
   *
   * v1 note: `DISCONNECTED` covers what the architecture spec calls both `disabled`
   * (admin-disabled) and `error` (irrecoverable failure). v1 unifies them into a
   * single terminal state for simplicity; the spec's two-state distinction is
   * deferred to v2 when admin controls are added.
   */
  static STATUSES = {
    ACTIVE: 'active',
    REQUIRES_REAUTH: 'requires_reauth',
    DISCONNECTED: 'disconnected',
  };

  /**
   * Returns true when this connection is healthy and ready to create tickets.
   *
   * @returns {boolean}
   */
  isActive() {
    return this.getStatus() === TaskManagementConnection.STATUSES.ACTIVE;
  }

  /**
   * Marks the connection as requiring re-authentication (e.g. after a failed
   * token refresh). Persists the status immediately so other services see the
   * degraded state without waiting for the next GC cycle.
   *
   * @returns {Promise<TaskManagementConnection>}
   */
  async markRequiresReauth() {
    this.setStatus(TaskManagementConnection.STATUSES.REQUIRES_REAUTH);
    return this.save();
  }
}

export default TaskManagementConnection;
