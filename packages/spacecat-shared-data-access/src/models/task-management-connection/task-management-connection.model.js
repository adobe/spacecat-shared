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
 * Status lifecycle (per architecture spec):
 *   active           → tokens are valid, tickets can be created
 *   disabled         → admin-disabled; no tickets until re-enabled
 *   requires_reauth  → refresh token expired/revoked, user must reconnect
 *   error            → repeated API failures; connection degraded
 *   disconnected     → explicitly deleted by the user (v1 soft-delete)
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
   * Connection health statuses (per architecture spec PR #150).
   *
   * DISCONNECTED is a v1 extension — it represents the "deleted" lifecycle
   * event as a soft-delete so audit history is preserved. The spec hard-deletes
   * the row; v1 keeps it with status='disconnected' until a GC job removes it.
   */
  static STATUSES = {
    ACTIVE: 'active',
    DISABLED: 'disabled',
    REQUIRES_REAUTH: 'requires_reauth',
    ERROR: 'error',
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
   * token refresh). Persists immediately so other services see the degraded
   * state without waiting for the next GC cycle.
   *
   * @returns {Promise<TaskManagementConnection>}
   */
  async markRequiresReauth() {
    this.setStatus(TaskManagementConnection.STATUSES.REQUIRES_REAUTH);
    return this.save();
  }

  /**
   * Marks the connection as disabled (e.g. admin-disabled).
   *
   * @returns {Promise<TaskManagementConnection>}
   */
  async markDisabled() {
    this.setStatus(TaskManagementConnection.STATUSES.DISABLED);
    return this.save();
  }

  /**
   * Marks the connection as in an error state (repeated API failures).
   *
   * @returns {Promise<TaskManagementConnection>}
   */
  async markError() {
    this.setStatus(TaskManagementConnection.STATUSES.ERROR);
    return this.save();
  }

  /**
   * Marks the connection as disconnected (user-initiated soft-delete).
   * v1 preserves the row for audit; a GC job handles eventual hard deletion.
   *
   * @returns {Promise<TaskManagementConnection>}
   */
  async markDisconnected() {
    this.setStatus(TaskManagementConnection.STATUSES.DISCONNECTED);
    return this.save();
  }
}

export default TaskManagementConnection;
