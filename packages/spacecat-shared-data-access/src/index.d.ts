/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// TODO: introduce AuditType interface or Scores interface

export interface Audit {
  getSiteId: () => string;
  getAuditedAt: () => string;
  getAuditResult: () => object;
  getAuditType: () => object;
  getExpiresAt: () => Date;
  getFullAuditRef: () => string;
  getScores: () => object;
}

export interface Site {
  getId: () => string;
  getBaseURL: () => string;
  getImsOrgId: () => string;
  getCreatedAt: () => string;
  getUpdatedAt: () => string;
  getAudits: () => Audit[];
  updateImsOrgId: (imsOrgId: string) => Site;
  setAudits: (audits: Audit[]) => Site;
}

export interface DataAccess {
  getAuditsForSite: (
    siteId: string,
    auditType?: string
  ) => Promise<Audit[]>;
  getLatestAuditForSite: (
    siteId: string,
    auditType: string,
  ) => Promise<Audit | null>;
  getLatestAudits: (
    auditType: string,
    ascending?: boolean,
  ) => Promise<Audit[]>;
  getLatestAuditsForSite: (
    siteId: string,
  ) => Promise<Audit[]>;
  getSites: () => Promise<Site[]>;
  getSitesToAudit: () => Promise<string[]>;
  getSitesWithLatestAudit: (
    auditType: string,
    sortAuditsAscending?: boolean,
  ) => Promise<Site[]>;
  getSiteByBaseURL: (
    baseUrl: string,
  ) => Promise<Site | null>;
  getSiteByBaseURLWithAuditInfo: (
    baseUrl: string,
    auditType: string,
    latestOnly?: boolean,
  ) => Promise<Site | null>;
  getSiteByBaseURLWithAudits: (
    baseUrl: string,
    auditType: string,
  ) => Promise<Site | null>;
  getSiteByBaseURLWithLatestAudit: (
    baseUrl: string,
    auditType: string,
  ) => Promise<Site | null>;
  addSite: (
    siteData: object,
  ) => Promise<Site>;
  updateSite: (
    site: Site,
  ) => Promise<Site>;
  removeSite: (
    siteId: string,
  ) => Promise<void>;
}

export function createDataAccess(
  logger: object,
): DataAccess;
