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
  BaseCollection, BaseModel, Organization, SiteEnrollment,
} from '../index';

export type EntitlementStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export type EntitlementTier = 'FREE_TRIAL' | 'PAID';
export type EntitlementProductCode = 'LLMO' | 'ASO';

export interface Entitlement extends BaseModel {
  getProductCode(): EntitlementProductCode;
  getTier(): EntitlementTier;
  getStatus(): EntitlementStatus;
  getQuotas(): object | null;
  getOrganization(): Promise<Organization>;
  getSiteEnrollments(): Promise<SiteEnrollment[]>;
  setProductCode(productCode: EntitlementProductCode): Entitlement;
  setTier(tier: EntitlementTier): Entitlement;
  setStatus(status: EntitlementStatus): Entitlement;
  setQuotas(quotas: object): Entitlement;
}

export interface EntitlementCollection extends
    BaseCollection<Entitlement> {
  allByOrganizationId(organizationId: string): Promise<Entitlement[]>;
  allByOrganizationIdAndProductCode(
    organizationId: string,
    productCode: EntitlementProductCode,
  ): Promise<Entitlement[]>;
  allByStatus(status: EntitlementStatus): Promise<Entitlement[]>;
  allByStatusAndUpdatedAt(status: EntitlementStatus, updatedAt: string): Promise<Entitlement[]>;
  findByOrganizationId(organizationId: string): Promise<Entitlement[]>;
  findByOrganizationIdAndProductCode(
    organizationId: string,
    productCode: EntitlementProductCode,
  ): Promise<Entitlement[]>;
  findByStatus(status: EntitlementStatus): Promise<Entitlement[]>;
  findByStatusAndUpdatedAt(status: EntitlementStatus, updatedAt: string): Promise<Entitlement[]>;
}
