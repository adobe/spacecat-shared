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

import type {
  BaseCollection, BaseModel, Organization, TrialUser,
} from '../index';

export type ProviderType = 'IMS' | 'MICROSOFT' | 'GOOGLE';

export interface OrganizationIdentityProvider extends BaseModel {
  getMetadata(): object | null;
  getProvider(): ProviderType;
  getExternalId(): string;
  getOrganization(): Promise<Organization>;
  getTrialUsers(): Promise<TrialUser[]>;
  setMetadata(metadata: object): OrganizationIdentityProvider;
  setProvider(provider: ProviderType): OrganizationIdentityProvider;
  setExternalId(externalId: string): OrganizationIdentityProvider;
}

export interface OrganizationIdentityProviderCollection extends
    BaseCollection<OrganizationIdentityProvider> {
  allByProvider(provider: ProviderType): Promise<OrganizationIdentityProvider[]>;
  allByProviderAndExternalId(provider: ProviderType, externalId: string):
    Promise<OrganizationIdentityProvider[]>;
  allByOrganizationId(organizationId: string): Promise<OrganizationIdentityProvider[]>;
  findByProvider(provider: ProviderType): Promise<OrganizationIdentityProvider[]>;
  findByProviderAndExternalId(provider: ProviderType, externalId: string):
    Promise<OrganizationIdentityProvider | null>;
  findByOrganizationId(organizationId: string): Promise<OrganizationIdentityProvider[]>;
}
