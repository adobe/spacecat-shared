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

import type {
  BaseCollection, BaseModel, Organization,
} from '../index';
import type { ProviderType } from '../organization-identity-provider';

export type Status = 'INVITED' | 'REGISTERED' | 'BLOCKED' | 'DELETED';

export interface TrialUser extends BaseModel {
  getExternalUserId(): string;
  getStatus(): Status;
  getProvider(): ProviderType;
  getLastSeenAt(): Date | null;
  getMetadata(): object | null;
  getOrganization(): Promise<Organization>;
  getEmailId(): string;
  getFirstName(): string | null;
  getLastName(): string | null;
  getTrialUserActivities(): Promise<TrialUserActivity[]>;
  setExternalUserId(externalUserId: string): TrialUser;
  setStatus(status: Status): TrialUser;
  setProvider(provider: ProviderType): TrialUser;
  setLastSeenAt(lastSeenAt: Date): TrialUser;
  setMetadata(metadata: object): TrialUser;
  setEmailId(emailId: string): TrialUser;
  setFirstName(firstName: string): TrialUser;
  setLastName(lastName: string): TrialUser;
}

export interface TrialUserCollection extends BaseCollection<TrialUser> {
  allByProvider(provider: ProviderType): Promise<TrialUser[]>;
  allByProviderAndExternalUserId(provider: ProviderType, externalId: string): Promise<TrialUser[]>;
  allByOrganizationId(organizationId: string): Promise<TrialUser[]>;
  allByEmailId(emailId: string): Promise<TrialUser[]>;
  findByProvider(provider: ProviderType): Promise<TrialUser | null>;
  findByProviderAndExternalUserId(provider: ProviderType, externalId: string):
    Promise<TrialUser | null>;
  findByOrganizationId(organizationId: string): Promise<TrialUser | null>;
  findByEmailId(emailId: string): Promise<TrialUser | null>;
}
