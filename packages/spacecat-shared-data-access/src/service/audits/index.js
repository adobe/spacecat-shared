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
  addAudit, getAuditForSite,
  getAuditsForSite,
  getLatestAuditForSite,
  getLatestAudits,
  removeAuditsForSite,
} from './accessPatterns.js';

export const auditFunctions = (dynamoClient, log) => ({
  getAuditForSite: (siteId, auditType, auditedAt) => getAuditForSite(
    dynamoClient,
    log,
    siteId,
    auditType,
    auditedAt,
  ),
  getAuditsForSite: (siteId, auditType) => getAuditsForSite(
    dynamoClient,
    log,
    siteId,
    auditType,
  ),
  getLatestAudits: (auditType, ascending) => getLatestAudits(
    dynamoClient,
    log,
    auditType,
    ascending,
  ),
  getLatestAuditForSite: (siteId, auditType) => getLatestAuditForSite(
    dynamoClient,
    log,
    siteId,
    auditType,
  ),
  addAudit: (auditData) => addAudit(
    dynamoClient,
    log,
    auditData,
  ),
  removeAuditsForSite: (siteId) => removeAuditsForSite(
    dynamoClient,
    log,
    siteId,
  ),
});
