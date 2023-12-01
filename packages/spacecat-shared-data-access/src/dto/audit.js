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

import { createAudit } from '../models/audit.js';

function parseEpochToDate(epochInSeconds) {
  const milliseconds = epochInSeconds * 1000;
  return new Date(milliseconds);
}

function convertDateToEpochSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Data transfer object for Audit.
 */
export const AuditDto = {
  /**
   * Converts an Audit object into a DynamoDB item.
   * @param {Readonly<Audit>} audit - Audit object.
   * @param {boolean} latestAudit - If true, returns the latest audit flavor.
   * @returns {{siteId, auditedAt, auditResult, auditType, expiresAt, fullAuditRef, SK: string}}
   */
  toDynamoItem: (audit, latestAudit = false) => {
    const latestAuditProps = latestAudit ? {
      GSI1PK: 'ALL_LATEST_AUDITS',
      GSI1SK: `${audit.getAuditType()}#${Object.values(audit.getScores()).join('#')}`,
    } : {};

    return {
      siteId: audit.getSiteId(),
      auditedAt: audit.getAuditedAt(),
      auditResult: audit.getAuditResult(),
      auditType: audit.getAuditType(),
      expiresAt: convertDateToEpochSeconds(audit.getExpiresAt()),
      fullAuditRef: audit.getFullAuditRef(),
      SK: `${audit.getAuditType()}#${audit.getAuditedAt()}`,
      ...latestAuditProps,
    };
  },

  /**
   * Converts a DynamoDB item into an Audit object.
   * @param {object} dynamoItem - DynamoDB item.
   * @returns {Readonly<Audit>} Audit object.
   */
  fromDynamoItem: (dynamoItem) => {
    const auditData = {
      siteId: dynamoItem.siteId,
      auditedAt: dynamoItem.auditedAt,
      auditResult: dynamoItem.auditResult,
      auditType: dynamoItem.auditType,
      expiresAt: parseEpochToDate(dynamoItem.expiresAt),
      fullAuditRef: dynamoItem.fullAuditRef,
    };

    return createAudit(auditData);
  },
};
