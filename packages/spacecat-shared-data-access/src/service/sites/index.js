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
  getSites,
  getSitesToAudit,
  getSitesWithLatestAudit,
  updateSite,
} from './accessPatterns.js';

export const siteFunctions = (dynamoClient, log) => ({
  getSites: () => getSites(
    dynamoClient,
  ),
  getSitesToAudit: () => getSitesToAudit(
    dynamoClient,
  ),
  getSitesWithLatestAudit: (auditType, sortAuditsAscending) => getSitesWithLatestAudit(
    dynamoClient,
    log,
    auditType,
    sortAuditsAscending,
  ),
  getSiteByBaseURL: (baseUrl) => getSiteByBaseURL(
    dynamoClient,
    log,
    baseUrl,
  ),
  getSiteByBaseURLWithAuditInfo: (baseUrl, auditType, latestOnly) => getSiteByBaseURLWithAuditInfo(
    dynamoClient,
    log,
    baseUrl,
    auditType,
    latestOnly,
  ),
  getSiteByBaseURLWithAudits: (baseUrl, auditType) => getSiteByBaseURLWithAudits(
    dynamoClient,
    log,
    baseUrl,
    auditType,
  ),
  getSiteByBaseURLWithLatestAudit: (baseUrl, auditType) => getSiteByBaseURLWithLatestAudit(
    dynamoClient,
    log,
    baseUrl,
    auditType,
  ),
  addSite: (siteData) => addSite(dynamoClient, log, siteData),
  updateSite: (site) => updateSite(dynamoClient, log, site),
});
