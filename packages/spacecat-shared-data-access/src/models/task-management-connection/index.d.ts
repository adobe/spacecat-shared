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

import type { BaseCollection, BaseModel, Ticket } from '../index';

export interface TaskManagementConnection extends BaseModel {
  /** Returns true when the connection is healthy and ready to create tickets. */
  isActive(): boolean;
  /**
   * Persists status = 'requires_reauth'. Call this after a failed token refresh
   * so the UI can prompt the user to reconnect.
   */
  markRequiresReauth(): Promise<TaskManagementConnection>;
  /** Persists status = 'disabled'. */
  markDisabled(): Promise<TaskManagementConnection>;
  /** Persists status = 'error' after repeated API failures. */
  markError(): Promise<TaskManagementConnection>;
  /** Persists status = 'active' after a successful re-authorization. */
  markActive(): Promise<TaskManagementConnection>;
  /** Persists status = 'disconnected' (soft-delete on user revoke). */
  markDisconnected(): Promise<TaskManagementConnection>;

  getConnectedBy(): string;
  getExternalInstanceId(): string;
  getDisplayName(): string;
  getErrorMessage(): string | null;
  getInstanceUrl(): string;
  getLastUsedAt(): string | null;
  getMetadata(): object;
  getOrganizationId(): string;
  getProvider(): string;
  getStatus(): string;
  getTickets(): Promise<Ticket[]>;

  setErrorMessage(message: string | null): TaskManagementConnection;
  setLastUsedAt(timestamp: string): TaskManagementConnection;
  setMetadata(metadata: object): TaskManagementConnection;
  setStatus(status: string): TaskManagementConnection;
}

export interface TaskManagementConnectionCollection extends BaseCollection<TaskManagementConnection> {
  /**
   * Returns the active connection for an org + provider pair used by the
   * ticket-creation API before every ticket request, or null if none exists.
   */
  findActiveByOrganizationAndProvider(
    organizationId: string,
    provider: string,
  ): Promise<TaskManagementConnection | null>;

  allByOrganizationId(organizationId: string): Promise<TaskManagementConnection[]>;
  allByOrganizationIdAndProvider(
    organizationId: string,
    provider: string,
  ): Promise<TaskManagementConnection[]>;
  allByOrganizationIdAndProviderAndStatus(
    organizationId: string,
    provider: string,
    status: string,
  ): Promise<TaskManagementConnection[]>;
  findByOrganizationIdAndProviderAndStatus(
    organizationId: string,
    provider: string,
    status: string,
  ): Promise<TaskManagementConnection | null>;
}
