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
  addAudit,
  getAuditForSite,
  getAuditsForSite,
  getLatestAuditForSite,
  getLatestAudits,
  getLatestAuditsForSite,
  removeAuditsForSite,
} from './accessPatterns.js';

export const auditFunctions = (dynamoClient, config, log) => ({
  getAuditForSite: (siteId, auditType, auditedAt) => getAuditForSite(
    dynamoClient,
    config,
    log,
    siteId,
    auditType,
    auditedAt,
  ),
  getAuditsForSite: (siteId, auditType) => getAuditsForSite(
    dynamoClient,
    config,
    log,
    siteId,
    auditType,
  ),
  getLatestAudits: (auditType, ascending) => getLatestAudits(
    dynamoClient,
    config,
    log,
    auditType,
    ascending,
  ),
  getLatestAuditForSite: (siteId, auditType) => getLatestAuditForSite(
    dynamoClient,
    config,
    log,
    siteId,
    auditType,
  ),
  getLatestAuditsForSite: (siteId) => getLatestAuditsForSite(
    dynamoClient,
    config,
    log,
    siteId,
  ),
  addAudit: (auditData) => addAudit(
    dynamoClient,
    config,
    log,
    auditData,
  ),
  removeAuditsForSite: (siteId) => removeAuditsForSite(
    dynamoClient,
    config,
    log,
    siteId,
  ),
});
