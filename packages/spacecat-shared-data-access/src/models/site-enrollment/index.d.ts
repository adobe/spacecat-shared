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
  BaseCollection, BaseModel, Site, Entitlement,
} from '../index';

export type SiteEnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';

export interface SiteEnrollment extends BaseModel {
  getStatus(): SiteEnrollmentStatus;
  getSite(): Promise<Site>;
  getEntitlement(): Promise<Entitlement>;
  setStatus(status: SiteEnrollmentStatus): SiteEnrollment;
  getConfig(): Record<string, string>;
  setConfig(config: Record<string, string>): SiteEnrollment;
}

export interface SiteEnrollmentCollection extends
    BaseCollection<SiteEnrollment> {
  allBySiteId(siteId: string): Promise<SiteEnrollment[]>;
  allByEntitlementId(entitlementId: string): Promise<SiteEnrollment[]>;

  findBySiteId(siteId: string): Promise<SiteEnrollment | null>;
  findByEntitlementId(entitlementId: string): Promise<SiteEnrollment | null>;
}
