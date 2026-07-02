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

import type { BaseCollection, BaseModel, Organization } from '../index';

export interface IdempotencyKey extends BaseModel {
  getEndpoint(): string;
  getExpiresAt(): string;
  getKey(): string;
  getOrganization(): Promise<Organization>;
  getOrganizationId(): string;
  getResponse(): Record<string, unknown> | null;
  getStatus(): string;

  setResponse(response: Record<string, unknown> | null): IdempotencyKey;
  setStatus(status: string): IdempotencyKey;
}

export interface IdempotencyKeyCollection extends BaseCollection<IdempotencyKey> {
  allByOrganizationId(organizationId: string): Promise<IdempotencyKey[]>;

  /**
   * Finds a non-expired idempotency key by its value and organization.
   * Returns null when no active key exists.
   */
  findActiveKey(key: string, organizationId: string): Promise<IdempotencyKey | null>;

  /**
   * Deletes all expired idempotency keys. Returns the number deleted.
   */
  deleteExpired(): Promise<number>;
}
