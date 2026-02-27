/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { BaseCollection, BaseModel } from '../index';

export type ConsumerStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Consumer extends BaseModel {
  getClientId(): string;
  getTechnicalAccountId(): string;
  getConsumerName(): string;
  getStatus(): ConsumerStatus;
  getCapabilities(): string[];
  getImsOrgId(): string;
  getRevokedAt(): string | undefined;
  isRevoked(): boolean;
  setConsumerName(consumerName: string): Consumer;
  setStatus(status: ConsumerStatus): Consumer;
  setCapabilities(capabilities: string[]): Consumer;
  setRevokedAt(revokedAt: string): Consumer;
}

export interface ConsumerCollection extends BaseCollection<Consumer> {
  allByImsOrgId(imsOrgId: string): Promise<Consumer[]>;
  allByClientId(clientId: string): Promise<Consumer[]>;
  allByClientIdAndImsOrgId(clientId: string, imsOrgId: string): Promise<Consumer[]>;
  findByImsOrgId(imsOrgId: string): Promise<Consumer | null>;
  findByClientId(clientId: string): Promise<Consumer | null>;
  findByClientIdAndImsOrgId(clientId: string, imsOrgId: string): Promise<Consumer | null>;
}
