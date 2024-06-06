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

import { ImportJobDto } from '../../dto/import-job.js';
import { createImportJob } from '../../models/importer/import-job.js';

/**
 * Get Import Job by ID
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
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND status = :status',
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
