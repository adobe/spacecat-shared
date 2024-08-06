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

import { hasText, isObject } from '@adobe/spacecat-shared-utils';

import { AuditDto } from '../../dto/audit.js';
import { createAudit } from '../../models/audit.js';

/**
 * Retrieves audits for a specified site. If an audit type is provided,
 * it returns only audits of that type.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which audits are being retrieved.
 * @param {string} [auditType] - Optional. The type of audits to retrieve.
 * @param {boolean} [ascending] - Optional. Determines if the audits should be sorted
 * ascending. Default is true.
 * @returns {Promise<Readonly<Audit>[]>} A promise that resolves to an array of audits
 * for the specified site.
 */
export const getAuditsForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
  auditType,
  ascending = true,
) => {
  const queryParams = {
    TableName: config.tableNameAudits,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: {
      ':siteId': siteId,
    },
    ScanIndexForward: ascending, // Sorts ascending if true, descending if false
  };

  if (hasText(auditType)) {
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
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which to retrieve the audit.
 * @param {string} auditType - The type of audit to retrieve.
 * @param auditedAt - The ISO 8601 timestamp of the audit.
 * @returns {Promise<Readonly<Audit>|null>}
 */
export const getAuditForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
  auditType,
  auditedAt,
) => {
  const audit = await dynamoClient.getItem(config.tableNameAudits, {
    siteId,
    SK: `${auditType}#${auditedAt}`,
  });

  return audit ? AuditDto.fromDynamoItem(audit) : null;
};

/**
 * Retrieves the latest audits of a specific type across all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} auditType - The type of audits to retrieve.
 * @param {boolean} ascending - Determines if the audits should be sorted ascending
 * or descending by scores.
 * @returns {Promise<Readonly<Audit>[]>} A promise that resolves to an array of the latest
 * audits of the specified type.
 */
export const getLatestAudits = async (
  dynamoClient,
  config,
  log,
  auditType,
  ascending = true,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameLatestAudits,
    IndexName: config.indexNameAllLatestAuditScores,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :auditType)',
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllLatestAudits,
      ':auditType': `${auditType}#`,
    },
    ScanIndexForward: ascending, // Sorts ascending if true, descending if false
  });

  return dynamoItems.map((item) => AuditDto.fromDynamoItem(item));
};

/**
 * Retrieves latest audits for a specified site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which audits are being retrieved.
 * @returns {Promise<Readonly<Audit>[]>} A promise that resolves to an array of latest audits
 * for the specified site.
 */
export const getLatestAuditsForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  const queryParams = {
    TableName: config.tableNameLatestAudits,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: { ':siteId': siteId },
  };

  const dynamoItems = await dynamoClient.query(queryParams);

  return dynamoItems.map((item) => AuditDto.fromDynamoItem(item));
};

/**
 * Retrieves the latest audit for a specified site and audit type.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which the latest audit is being retrieved.
 * @param {string} auditType - The type of audit to retrieve the latest instance of.
 * @returns {Promise<Audit|null>} A promise that resolves to the latest audit of the
 * specified type for the site, or null if none is found.
 */
export const getLatestAuditForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
  auditType,
) => {
  const latestAudit = await dynamoClient.getItem(config.tableNameLatestAudits, {
    siteId,
    auditType,
  });

  return latestAudit ? AuditDto.fromDynamoItem(latestAudit) : null;
};

/**
 * Adds an audit.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {object} auditData - The audit data.
 * @returns {Promise<Readonly<Audit>>}
 */
export const addAudit = async (
  dynamoClient,
  config,
  log,
  auditData,
) => {
  const newAudit = createAudit(auditData);
  const existingAudit = await getAuditForSite(
    dynamoClient,
    config,
    log,
    newAudit.getSiteId(),
    newAudit.getAuditType(),
    newAudit.getAuditedAt(),
  );

  if (isObject(existingAudit)) {
    throw new Error('Audit already exists');
  }

  const latestAudit = await getLatestAuditForSite(
    dynamoClient,
    config,
    log,
    newAudit.getSiteId(),
    newAudit.getAuditType(),
  );

  if (isObject(latestAudit)) {
    newAudit.setPreviousAuditResult({
      ...latestAudit.getAuditResult(),
      auditedAt: latestAudit.getAuditedAt(),
      fullAuditRef: latestAudit.getFullAuditRef(),
    });
  }

  // TODO: Add transaction support
  await dynamoClient.putItem(config.tableNameAudits, AuditDto.toDynamoItem(newAudit));
  await dynamoClient.putItem(
    config.tableNameLatestAudits,
    AuditDto.toDynamoItem(newAudit, true),
  );

  return newAudit;
};

/**
 * Removes audits from the database.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param audits
 * @param latest
 * @returns {Promise<void>}
 */
async function removeAudits(
  dynamoClient,
  config,
  audits,
  latest = false,
) {
  const tableName = latest ? config.tableNameLatestAudits : config.tableNameAudits;
  // TODO: use batch-remove (needs dynamo client update)
  const removeAuditPromises = audits.map((audit) => {
    const sortKey = latest
      ? { auditType: `${audit.getAuditType()}` }
      : { SK: `${audit.getAuditType()}#${audit.getAuditedAt()}` };
    return dynamoClient.removeItem(
      tableName,
      {
        siteId: audit.getSiteId(),
        ...sortKey,
      },
    );
  });

  await Promise.all(removeAuditPromises);
}

/**
 * Updates existing latest audit.
 * This can be used for adding suggestions for example.
 * @param dynamoClient - The DynamoDB client.
 * @param config - The data access config.
 * @param log - The logger.
 * @param auditData - The audit data.
 * @returns {Promise<Readonly<Audit>>}
 */
export const updateLatestAudit = async (
  dynamoClient,
  config,
  log,
  auditData,
) => {
  const newAudit = createAudit(auditData);
  const existingAudit = await getLatestAuditForSite(
    dynamoClient,
    config,
    log,
    newAudit.getSiteId(),
    newAudit.getAuditType(),
  );

  if (!isObject(existingAudit)) {
    throw new Error('Audit not found');
  }

  await dynamoClient.putItem(
    config.tableNameLatestAudits,
    AuditDto.toDynamoItem(newAudit, true),
  );

  return newAudit;
};

/**
 * Removes all audits for a specified site and the latest audit entry.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which audits are being removed.
 * @returns {Promise<void>}
 */
export const removeAuditsForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  try {
    const audits = await getAuditsForSite(dynamoClient, config, log, siteId);
    const latestAudits = await getLatestAuditsForSite(dynamoClient, config, log, siteId);

    await removeAudits(dynamoClient, config, audits);
    await removeAudits(dynamoClient, config, latestAudits, true);
  } catch (error) {
    log.error(`Error removing audits for site ${siteId}: ${error.message}`);
    throw error;
  }
};
