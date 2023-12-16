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
  isLive: () => boolean;
  isError: () => boolean;
  getScores: () => object;
}

// AuditConfigType defines the structure for specific audit type configurations
export interface AuditConfigType {
  disabled(): boolean;
}

// AuditConfig defines the structure for the overall audit configuration of a site
export interface AuditConfig {
  auditsDisabled: () => boolean;
  getAuditConfigForType: (auditType: string) => AuditConfigType;
}

export interface Site {
  getId: () => string;
  getBaseURL: () => string;
  getGitHubURL: () => string;
  getImsOrgId: () => string;
  getCreatedAt: () => string;
  getUpdatedAt: () => string;
  getAuditConfig: () => AuditConfig;
  getAudits: () => Audit[];
  isLive: () => boolean;
  setAudits: (audits: Audit[]) => Site;
  toggleLive: () => Site;
  updateGitHubURL: (gitHubURL: string) => Site;
  updateImsOrgId: (imsOrgId: string) => Site;
}

export interface DataAccess {
  getAuditsForSite: (
    siteId: string,
    auditType?: string,
    ascending?: boolean,
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
  addAudit: (
    auditData: object,
  ) => Promise<Audit>;
  removeAuditsForSite: (
    siteId: string,
  ) => Promise<void>;
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
  getSiteByID: (
    siteId: string,
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

interface DataAccessConfig {
  tableNameAudits: string;
  tableNameLatestAudits: string;
  tableNameSites: string;
  indexNameAllSites: string;
  indexNameAllLatestAuditScores: string;
  pkAllSites: string;
  pkAllLatestAudits: string;
}

export function createDataAccess(
  config: DataAccessConfig,
  logger: object,
): DataAccess;
