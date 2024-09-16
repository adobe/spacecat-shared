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

import { isArray, isObject } from '@adobe/spacecat-shared-utils';
import { ImportJobDto } from '../../dto/import-job.js';
import { createImportJob } from '../../models/importer/import-job.js';
import { getImportUrlsByJobId } from '../import-url/accessPatterns.js';
import { ImportUrlStatus } from '../../models/importer/import-constants.js';

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
  const jobEntity = await dynamoClient.getItem(
    config.tableNameImportJobs,
    { id },
  );

  if (!jobEntity) {
    return null;
  }

  const jobModel = ImportJobDto.fromDynamoItem(jobEntity);

  const importUrls = await getImportUrlsByJobId(dynamoClient, config, log, id);

  if (isArray(importUrls)) {
    jobModel.state.progress = importUrls.reduce((acc, importUrl) => {
      // eslint-disable-next-line default-case
      switch (importUrl.state.status) {
        case ImportUrlStatus.PENDING:
          acc.pending += 1;
          break;
        case ImportUrlStatus.REDIRECT:
          acc.redirect += 1;
          break;
        case ImportUrlStatus.RUNNING:
          acc.running += 1;
          break;
        case ImportUrlStatus.COMPLETE:
          acc.completed += 1;
          break;
        case ImportUrlStatus.FAILED:
          acc.failed += 1;
          break;
      }
      return acc;
    }, {
      pending: 0,
      redirect: 0,
      running: 0,
      completed: 0,
      failed: 0,
    });
  }

  return jobModel;
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
