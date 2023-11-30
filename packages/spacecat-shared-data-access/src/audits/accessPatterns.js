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

import { isObject } from '@adobe/spacecat-shared-utils';

import { AuditDto } from '../dto/audit.js';
import { createAudit } from '../models/audit.js';

/**
 * Retrieves audits for a specified site. If an audit type is provided,
 * it returns only audits of that type.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which audits are being retrieved.
 * @param {string} [auditType] - Optional. The type of audits to retrieve.
 * @returns {Promise<Array>} A promise that resolves to an array of audits for the specified site.
 */
export const getAuditsForSite = async (dynamoClient, log, siteId, auditType) => {
  // Base query parameters
  const queryParams = {
    TableName: 'audits',
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: {
      ':siteId': siteId,
    },
  };

  if (auditType !== undefined) {
    queryParams.KeyConditionExpression += ' AND begins_with(SK, :auditType)';
    queryParams.ExpressionAttributeValues[':auditType'] = `${auditType}#`;
  }

  const dynamoItems = await dynamoClient.query(queryParams);

  return dynamoItems.map((item) => AuditDto.fromDynamoItem(item));
};

/**
 * Retrieves a specific audit for a specified site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which to retrieve the audit.
 * @param {string} auditType - The type of audit to retrieve.
 * @param auditedAt - The ISO 8601 timestamp of the audit.
 * @returns {Promise<Readonly<Audit>|null>}
 */
export const getAuditForSite = async (
  dynamoClient,
  log,
  siteId,
  auditType,
  auditedAt,
) => {
  const audit = await dynamoClient.query({
    TableName: 'audits',
    KeyConditionExpression: 'siteId = :siteId AND SK = :sk',
    ExpressionAttributeValues: {
      ':siteId': siteId,
      ':sk': `${auditType}#${auditedAt}}`,
    },
    Limit: 1,
  });

  return audit.length > 0 ? AuditDto.fromDynamoItem(audit[0]) : null;
};

/**
 * Retrieves the latest audits of a specific type across all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} auditType - The type of audits to retrieve.
 * @param {boolean} ascending - Determines if the audits should be sorted ascending
 * or descending by scores.
 * @returns {Promise<Array>} A promise that resolves to an array of the latest
 * audits of the specified type.
 */
export const getLatestAudits = async (
  dynamoClient,
  log,
  auditType,
  ascending = true,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: 'latest_audits',
    IndexName: 'all_latest_audit_scores',
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :auditType)',
    ExpressionAttributeValues: {
      ':gsi1pk': 'ALL_LATEST_AUDITS',
      ':auditType': `${auditType}#`,
    },
    ScanIndexForward: ascending, // Sorts ascending if true, descending if false
  });

  return dynamoItems.map((item) => AuditDto.fromDynamoItem(item));
};

/**
 * Retrieves the latest audit for a specified site and audit type.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which the latest audit is being retrieved.
 * @param {string} auditType - The type of audit to retrieve the latest instance of.
 * @returns {Promise<Audit|null>} A promise that resolves to the latest audit of the
 * specified type for the site, or null if none is found.
 */
export const getLatestAuditForSite = async (
  dynamoClient,
  log,
  siteId,
  auditType,
) => {
  const latestAudit = await dynamoClient.query({
    TableName: 'latest_audits',
    KeyConditionExpression: 'siteId = :siteId AND begins_with(SK, :auditType)',
    ExpressionAttributeValues: {
      ':siteId': siteId,
      ':auditType': `${auditType}#`,
    },
    Limit: 1,
  });

  return latestAudit.length > 0 ? AuditDto.fromDynamoItem(latestAudit[0]) : null;
};

/**
 * Adds an audit.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {object} auditData - The audit data.
 * @returns {Promise<Readonly<Site>>}
 */
export const addAudit = async (dynamoClient, log, auditData) => {
  const audit = createAudit(auditData);
  const existingAudit = await getAuditForSite(
    dynamoClient,
    log,
    audit.getSiteId(),
    audit.getAuditType(),
    audit.getAuditedAt(),
  );

  if (isObject(existingAudit)) {
    throw new Error('Audit already exists');
  }

  // TODO: Add transaction support
  await dynamoClient.putItem('audits', AuditDto.toDynamoItem(audit));
  await dynamoClient.putItem('latest_audits', AuditDto.toDynamoItem(audit, true));

  return audit;
};
