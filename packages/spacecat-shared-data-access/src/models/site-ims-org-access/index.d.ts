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
  BaseCollection, BaseModel, EntitlementProductCode, Organization, Site,
} from '../index';

export type SiteImsOrgAccessRole = 'collaborator' | 'agency' | 'viewer';

export interface SiteImsOrgAccess extends BaseModel {
  getSite(): Promise<Site>;
  getOrganization(): Promise<Organization>;
  getSiteId(): string;
  /** organizationId is the delegate org receiving access (read-only, part of grant identity). */
  getOrganizationId(): string;
  /** targetOrganizationId is the site-owning org (read-only, part of grant identity). */
  getTargetOrganizationId(): string;
  /** productCode is read-only; changing scope requires a new grant. */
  getProductCode(): EntitlementProductCode;
  getRole(): SiteImsOrgAccessRole;
  getGrantedBy(): string | null;
  getExpiresAt(): string | null;
  setRole(role: SiteImsOrgAccessRole): SiteImsOrgAccess;
  setGrantedBy(grantedBy: string): SiteImsOrgAccess;
  setExpiresAt(expiresAt: string): SiteImsOrgAccess;
}

export interface SiteImsOrgAccessGrantWithTarget {
  grant: {
    id: string;
    siteId: string;
    organizationId: string;
    targetOrganizationId: string;
    productCode: EntitlementProductCode;
    role: SiteImsOrgAccessRole;
    grantedBy: string | null;
    expiresAt: string | null;
  };
  targetOrganization: {
    id: string;
    imsOrgId: string;
  };
}

export interface SiteImsOrgAccessGrantWithSite {
  grant: {
    id: string;
    siteId: string;
    organizationId: string;
    targetOrganizationId: string;
    productCode: EntitlementProductCode;
    role: SiteImsOrgAccessRole;
    grantedBy: string | null;
    expiresAt: string | null;
  };
  /** Site model instance. Null only if the FK is broken (should not occur given ON DELETE CASCADE). */
  site: Site | null;
}

export interface SiteImsOrgAccessCollection extends
    BaseCollection<SiteImsOrgAccess> {
  allBySiteId(siteId: string): Promise<SiteImsOrgAccess[]>;
  allByOrganizationId(organizationId: string): Promise<SiteImsOrgAccess[]>;
  allByTargetOrganizationId(targetOrganizationId: string): Promise<SiteImsOrgAccess[]>;
  allByOrganizationIdWithTargetOrganization(organizationId: string): Promise<SiteImsOrgAccessGrantWithTarget[]>;
  allByOrganizationIdsWithTargetOrganization(organizationIds: string[]): Promise<SiteImsOrgAccessGrantWithTarget[]>;
  allByOrganizationIdWithSites(organizationId: string): Promise<SiteImsOrgAccessGrantWithSite[]>;

  findBySiteId(siteId: string): Promise<SiteImsOrgAccess | null>;
  findByOrganizationId(organizationId: string): Promise<SiteImsOrgAccess | null>;
  findByTargetOrganizationId(targetOrganizationId: string): Promise<SiteImsOrgAccess | null>;
  findBySiteIdAndOrganizationIdAndProductCode(siteId: string, organizationId: string, productCode: EntitlementProductCode): Promise<SiteImsOrgAccess | null>;
}
