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
import { ImportJobDto } from '../../dto/import-job.js';
import { createImportJob } from '../../models/importer/import-job.js';
import { removeUrlsForImportJob } from '../import-url/accessPatterns.js';

/**
 * Get all Import Jobs within a specific date range
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} startDate
 * @param {string} endDate
 */
export const getImportJobsByDateRange = async (dynamoClient, config, log, startDate, endDate) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameImportJobs,
    IndexName: config.indexNameAllImportJobsByDateRange,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND #startTime BETWEEN :startDate AND :endDate',
    ExpressionAttributeNames: {
      '#startTime': 'startTime',
    },
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllImportJobs,
      ':startDate': startDate,
      ':endDate': endDate,
    },
  });
  return items.map((item) => ImportJobDto.fromDynamoItem(item));
};

/**
 * Get Import Job by ID.
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} id
 * @returns {Promise<ImportJobDto> | null}
 */
export const getImportJobByID = async (dynamoClient, config, log, id) => {
  const item = await dynamoClient.getItem(
    config.tableNameImportJobs,
    { id },
  );

  return item ? ImportJobDto.fromDynamoItem(item) : null;
};

/**
 * Get Import jobs by status
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} status
 * @returns {Promise<ImportJobDto[]>}
 */
export const getImportJobsByStatus = async (dynamoClient, config, log, status) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameImportJobs,
    IndexName: config.indexNameAllImportJobsByStatus,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllImportJobs,
      ':status': status,
    },
  });
  return items.map((item) => ImportJobDto.fromDynamoItem(item));
};

/**
 * Creates a new Import Job
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {Object} importJobData
 * @returns {Promise<ImportJobDto>}
 */
export const createNewImportJob = async (dynamoClient, config, log, importJobData) => {
  const importJob = createImportJob(importJobData);
  await dynamoClient.putItem(config.tableNameImportJobs, ImportJobDto.toDynamoItem(importJob));
  return importJob;
};

/**
 * Updates an Import Job
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {ImportJobDto} importJob
 */
export const updateImportJob = async (dynamoClient, config, log, importJob) => {
  const existingImportJob = await getImportJobByID(dynamoClient, config, log, importJob.getId());

  if (!isObject(existingImportJob)) {
    throw new Error(`Import Job with id: ${importJob.getId()} does not exist`);
  }

  await dynamoClient.putItem(config.tableNameImportJobs, ImportJobDto.toDynamoItem(importJob));

  return importJob;
};

/**
 * Removes an Import Job and all associated URLs.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {ImportJob} importJob - The import job to remove.
 * @return {Promise<void>} A promise that resolves when the import job has been removed.
 */
export const removeImportJob = async (dynamoClient, config, log, importJob) => {
  try {
    await removeUrlsForImportJob(dynamoClient, config, log, importJob.getId());

    await dynamoClient.removeItem(config.tableNameImportJobs, { id: importJob.getId() });
  } catch (error) {
    log.error(`Error removing import job: ${error.message}`);
    throw error;
  }
};
