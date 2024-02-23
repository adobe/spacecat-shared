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

/**
 * Represents an individual audit of a site.
 */
export interface Audit {
  /**
   * Retrieves the site ID associated with this audit.
   * @returns {string} The site ID.
   */
  getSiteId: () => string;

  /**
   * Retrieves the timestamp when the audit was performed.
   * @returns {string} The audit timestamp.
   */
  getAuditedAt: () => string;

  /**
   * Retrieves the result of the audit.
   * @returns {object} The audit result.
   */
  getAuditResult: () => object;

  /**
   * Retrieves the result of the previous audit.
   * This serves for comparison purposes.
   * @returns {object|null} The parsed audit result.
   */
  getPreviousAuditResult: () => object | null;

  /**
   * Sets the result of the previous audit.
   * @param {object} result The parsed audit result.
   */
  setPreviousAuditResult: (result: object) => void;

  /**
   * Retrieves the type of the audit.
   * @returns {object} The audit type.
   */
  getAuditType: () => object;

  /**
   * Retrieves the expiration date of the audit.
   * @returns {Date} The expiration date.
   */
  getExpiresAt: () => Date;

  /**
   * Retrieves a reference to the full audit.
   * @returns {string} The full audit reference.
   */
  getFullAuditRef: () => string;

  /**
   * Indicates whether the audit is live.
   * @returns {boolean} True if the audit is live, false otherwise.
   */
  isLive: () => boolean;

  /**
   * Indicates whether there was an error in the audit.
   * @returns {boolean} True if there was an error, false otherwise.
   */
  isError: () => boolean;

  /**
   * Retrieves the scores from the audit.
   * @returns {object} The audit scores.
   */
  getScores: () => object;
}

/**
 * AuditConfigType defines the structure for specific audit type configurations.
 */
export interface AuditConfigType {
  /**
   * Returns true if the audit type is disabled for the site. If an audit type is disabled, no
   * audits of that type will be scheduled for the site.
   * @returns {boolean} True if the audit type is disabled for the site.
   */
  disabled: () => boolean;
}

export interface Config {

}

export interface FulfillableItems {
  items: string[];
}

/**
 * AuditConfig defines the structure for the overall audit configuration of a site.
 */
export interface AuditConfig {
  /**
   * Returns true if audits are disabled for the site. If audits are disabled, no audits will be
   * scheduled for the site. Overrides any audit type specific configurations.
   * @returns {boolean} True if audits are disabled for the site.
   */
  auditsDisabled: () => boolean;

  /**
   * Returns the audit config for a specific audit type. The audit type is the key.
   * @param {string} auditType The audit type to get the config for.
   * @returns {AuditConfigType} The audit config for the audit type.
   */
  getAuditTypeConfig: (auditType: string) => AuditConfigType;

  /**
   * Returns the audit configs for all audit types. The keys are the audit types.
   * @returns {object} The audit configs for all audit types.
   */
  getAuditTypeConfigs: () => object;
}

/**
 * Represents a site with associated audit and configuration data.
 */
export interface Site {
  /**
   * Retrieves the ID of the site.
   * @returns {string} The site ID.
   */
  getId: () => string;

  /**
   * Retrieves the base URL of the site.
   * @returns {string} The base URL.
   */
  getBaseURL: () => string;

  /**
   * Retrieves the delivery type of the site.
   * @returns {string} The delivery type.
   */
  getDeliveryType: () => string;

  /**
   * Retrieves the GitHub URL associated with the site.
   * @returns {string} The GitHub URL.
   */
  getGitHubURL: () => string;

  /**
   * Retrieves the Organization ID associated with the site.
   * @returns {string} The Org ID.
   */
  getOrganizationId: () => string;

  /**
   * Retrieves the creation timestamp of the site.
   * @returns {string} The creation timestamp.
   */
  getCreatedAt: () => string;

  /**
   * Retrieves the last update timestamp of the site.
   * @returns {string} The last update timestamp.
   */
  getUpdatedAt: () => string;

  /**
   * Retrieves the current audit configuration for the site.
   * @returns {AuditConfig} The current audit configuration.
   */
  getAuditConfig: () => AuditConfig;

  /**
   * Retrieves the current configuration for the site.
   * @returns {Config} The current configuration.
   */
  getConfig: () => Config;

  /**
   * Retrieves the audits associated with the site.
   * @returns {Audit[]} The list of audits.
   */
  getAudits: () => Audit[];

  /**
   * Indicates whether the site is live.
   * @returns {boolean} True if the site is live, false otherwise.
   */
  isLive: () => boolean;

  /**
   * The timestamp when the site was last toggled to live or non-live.
   * @returns {string} The timestamp when the site was last toggled to live or non-live.
   */
  getIsLiveToggledAt: () => string;

  /**
   * Updates the list of audits for the site.
   * @param {Audit[]} audits The new list of audits.
   * @returns {Site} The updated site instance.
   */
  setAudits: (audits: Audit[]) => Site;

  /**
   * Toggles the live status of the site.
   * @returns {Site} The updated site instance with the toggled live status.
   */
  toggleLive: () => Site;

  /**
   * Updates the GitHub URL of the site.
   * @param {string} gitHubURL The new GitHub URL.
   * @returns {Site} The updated site instance.
   */
  updateGitHubURL: (gitHubURL: string) => Site;

  /**
   * Updates the IMS Org ID of the site.
   * @param {string} organizationId The new Org ID.
   * @returns {Site} The updated site instance.
   */
  updateOrganizationId: (organizationId: string) => Site;
}

/**
 * Represents a site candidate.
 */
export interface SiteCandidate {
  /**
   * Retrieves the base URL of the site candidate.
   * @returns {string} The base URL.
   */
  getBaseURL: () => string;

  /**
   * Retrieves the site id of the site candidate.
   * Only set after APPROVED state
   * @returns {string} site id
   */
  getSiteId: () => string;

  /**
   * Retrieves the source of the site candidate.
   * @returns {string} The source
   */
  getSource: () => string;

  /**
   * Retrieves the status of the site candidate.
   * @returns {string} The status
   */
  getStatus: () => string;

  /**
   * Retrieves the creation timestamp of the site candidate.
   * @returns {string} The creation timestamp.
   */
  getCreatedAt: () => string;

  /**
   * Retrieves the last update timestamp of the site candidate.
   * @returns {string} The last update timestamp.
   */
  getUpdatedAt: () => string;

  /**
   * Retrieves the slack id of the person who last updated the site candidate.
   * @returns {string} The last update timestamp.
   */
  getUpdatedBy: () => string;
}

export interface Organization {
  /**
   * Retrieves the ID of the site.
   * @returns {string} The site ID.
   */
  getId: () => string;

  /**
   * Retrieves the base URL of the site.
   * @returns {string} The base URL.
   */
  getName: () => string;

  /**
   * Retrieves the IMS Organization ID associated with the site.
   * @returns {string} The IMS Org ID.
   */
  getImsOrgId: () => string;

  /**
   * Retrieves the creation timestamp of the site.
   * @returns {string} The creation timestamp.
   */
  getCreatedAt: () => string;

  /**
   * Retrieves the last update timestamp of the site.
   * @returns {string} The last update timestamp.
   */
  getUpdatedAt: () => string;

  /**
   * Retrieves the current audit configuration for the site.
   * @returns {Config} The current audit configuration.
   */
  getConfig: () => Config;

  /**
   * Retrieves the fulfillable items object for the org.
   * @returns {FulfillableItems} The current fulfillable items object.
   */
  getFulfillableItems: () => FulfillableItems;
}

export interface Configuration {
  /**
   * Retrieves the configuration version.
   * @returns {string} The configuration version.
   */
  getVersion: () => string;

  /**
   * Retrieves the queues configuration.
   * @returns {object} The queues configuration.
   */
  getQueues: () => object;

  /**
   * Retrieves the jobs configuration.
   * @returns {Array} The jobs configurations.
   */
  getJobs: () => Array<object>;

}

export interface DataAccess {
  getAuditForSite: (
    sitedId: string,
    auditType: string,
    auditedAt: string,
  ) => Promise<Audit | null>;
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
  getSitesByDeliveryType: (
    deliveryType: string,
  ) => Promise<Site[]>;
  getSitesToAudit: () => Promise<string[]>;
  getSitesWithLatestAudit: (
    auditType: string,
    sortAuditsAscending?: boolean,
    deliveryType?: string,
  ) => Promise<Site[]>;
  getSitesByOrganizationID: (
      organizationId: string,
  ) => Promise<Organization[]>
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
  removeSitesForOrganization: (
    organizationId: string,
  ) => Promise<void>;
  getOrganizations:
      () => Promise<Organization[]>;
  getOrganizationByID: (
      organizationID: string,
  ) => Promise<Organization | null>;
  getOrganizationByImsOrgID: (
      imsOrgID: string,
  ) => Promise<Organization | null>;
  addOrganization: (
      organizationData: object,
  ) => Promise<Organization>;
  updateOrganization: (
      organization: Organization,
  ) => Promise<Organization>;
  removeOrganization: (
      organizationId: string,
  ) => Promise<void>;

  // site candidate functions
  getSiteCandidateByBaseURL: (baseURL: string) => Promise<SiteCandidate>;
  upsertSiteCandidate: (siteCandidateDate: object) => Promise<SiteCandidate>;
  siteCandidateExists: (baseURL: string) => Promise<boolean>;
  updateSiteCandidate: (siteCandidate: SiteCandidate) => Promise<SiteCandidate>;

  // configuration functions
  getConfiguration: () => Promise<Configuration>
  getConfigurationByVersion: (version: string) => Promise<Configuration>
}

interface DataAccessConfig {
  tableNameAudits: string;
  tableNameLatestAudits: string;
  tableNameOrganizations: string,
  tableNameSites: string;
  tableNameSiteCandidates: string;
  tableNameConfigurations: string;
  indexNameAllSites: string;
  indexNameAllSitesOrganizations: string,
  indexNameAllSitesByDeliveryType: string;
  indexNameAllLatestAuditScores: string;
  indexNameAllOrganizations: string,
  indexNameAllOrganizationsByImsOrgId: string,
  pkAllSites: string;
  pkAllLatestAudits: string;
  pkAllOrganizations: string;
  pkAllConfigurations: string;
}

export function createDataAccess(
  config: DataAccessConfig,
  logger: object,
): DataAccess;
