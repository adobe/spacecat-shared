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

import {
  addSite,
  getSiteByBaseURL,
  getSiteByBaseURLWithAuditInfo,
  getSiteByBaseURLWithAudits,
  getSiteByBaseURLWithLatestAudit,
  getSiteByID,
  getSites,
  getSitesToAudit,
  getSitesWithLatestAudit, removeSite,
  updateSite,
} from './accessPatterns.js';

export const siteFunctions = (dynamoClient, config, log) => ({
  getSites: () => getSites(
    dynamoClient,
    config,
  ),
  getSitesToAudit: () => getSitesToAudit(
    dynamoClient,
    config,
  ),
  getSitesWithLatestAudit: (auditType, sortAuditsAscending) => getSitesWithLatestAudit(
    dynamoClient,
    config,
    log,
    auditType,
    sortAuditsAscending,
  ),
  getSiteByBaseURL: (baseUrl) => getSiteByBaseURL(
    dynamoClient,
    config,
    log,
    baseUrl,
  ),
  getSiteByID: (siteId) => getSiteByID(
    dynamoClient,
    config,
    log,
    siteId,
  ),
  getSiteByBaseURLWithAuditInfo: (baseUrl, auditType, latestOnly) => getSiteByBaseURLWithAuditInfo(
    dynamoClient,
    config,
    log,
    baseUrl,
    auditType,
    latestOnly,
  ),
  getSiteByBaseURLWithAudits: (baseUrl, auditType) => getSiteByBaseURLWithAudits(
    dynamoClient,
    config,
    log,
    baseUrl,
    auditType,
  ),
  getSiteByBaseURLWithLatestAudit: (baseUrl, auditType) => getSiteByBaseURLWithLatestAudit(
    dynamoClient,
    config,
    log,
    baseUrl,
    auditType,
  ),
  addSite: (siteData) => addSite(dynamoClient, config, log, siteData),
  updateSite: (site) => updateSite(dynamoClient, config, log, site),
  removeSite: (siteId) => removeSite(dynamoClient, config, log, siteId),
});
