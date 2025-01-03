/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { ImportUrlDto } from '../../dto/import-url.js';
import { createImportUrl } from '../../models/importer/import-url.js';

/**
 * Get import url by ID
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} id
 * @returns {Promise<ImportUrlDto> | null}
 */
export const getImportUrlById = async (dynamoClient, config, log, id) => {
  const item = await dynamoClient.getItem(
    config.tableNameImportUrls,
    { id },
  );
  return item ? ImportUrlDto.fromDynamoItem(item) : null;
};

/**
 * Create a new Import Url
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {Object} importUrlData
 * @returns {Promise<ImportUrlDto>}
 */
export const createNewImportUrl = async (dynamoClient, config, log, importUrlData) => {
  const importUrl = createImportUrl(importUrlData);
  await dynamoClient.putItem(
    config.tableNameImportUrls,
    ImportUrlDto.toDynamoItem(importUrl),
  );
  return importUrl;
};

/**
 * Update an existing Import Url
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {Object} importUrl
 * @returns {ImportUrlDto}
 */
export const updateImportUrl = async (dynamoClient, config, log, importUrl) => {
  const existingImportUrl = await getImportUrlById(
    dynamoClient,
    config,
    log,
    importUrl.getId(),
  );

  if (!isObject(existingImportUrl)) {
    throw new Error(`Import Url with ID: ${importUrl.getId()} does not exist`);
  }

  await dynamoClient.putItem(config.tableNameImportUrls, ImportUrlDto.toDynamoItem(importUrl));

  return importUrl;
};

/**
 * Get Import Urls by Job ID and Status
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} jobId
 * @param {string} status
 * @returns {Promise<ImportUrl[]>}
 */
export const getImportUrlsByJobIdAndStatus = async (dynamoClient, config, log, jobId, status) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameImportUrls,
    IndexName: config.indexNameImportUrlsByJobIdAndStatus,
    KeyConditionExpression: 'jobId = :jobId AND #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':jobId': jobId,
      ':status': status,
    },
  });
  return items.map((item) => ImportUrlDto.fromDynamoItem(item));
};

/**
 * Get Import Urls by Job ID, if no urls exist an empty array is returned.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The log.
 * @param {string} jobId - The ID of the import job.
 * @returns {Promise<ImportUrl[]>}
 */
export const getImportUrlsByJobId = async (dynamoClient, config, log, jobId) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameImportUrls,
    IndexName: config.indexNameImportUrlsByJobIdAndStatus,
    KeyConditionExpression: 'jobId = :jobId',
    ExpressionAttributeValues: {
      ':jobId': jobId,
    },
  });

  return items ? items.map((item) => ImportUrlDto.fromDynamoItem(item)) : [];
};

/**
 * Remove all given import URLs.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {ImportUrl[]} urls - The import URLs to remove.
 * @return {Promise<void>} A promise that resolves when all URLs have been removed.
 */
async function removeUrls(dynamoClient, config, urls) {
  const removeUrlPromises = urls.map((url) => dynamoClient.removeItem(
    config.tableNameImportUrls,
    { id: url.getId() },
  ));

  await Promise.all(removeUrlPromises);
}

/**
 * Remove all URLs associated with an import job.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The log.
 * @param {string} jobId - The ID of the import job.
 * @return {Promise<void>} A promise that resolves when all URLs have been removed.
 */
export const removeUrlsForImportJob = async (dynamoClient, config, log, jobId) => {
  try {
    const urls = await getImportUrlsByJobId(dynamoClient, config, log, jobId);
    await removeUrls(dynamoClient, config, urls);
  } catch (error) {
    log.error(`Error removing urls for import jobId: ${jobId} : ${error.message}`);
    throw error;
  }
};
