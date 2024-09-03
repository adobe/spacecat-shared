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

import { createImportJob } from '../models/importer/import-job.js';

/**
 * The ImportJobDto is a helper that can concert an ImportJob object to a DynamoDB item and
 * vice versa.
 */
export const ImportJobDto = {

  /**
   * Converts an ImportJob object into a DynamoDB item.
   * @param {Readonly<ImportJob>} importJob - The ImportJob object to convert.
   * @returns {Object} The new DynamoDB item.
   */
  toDynamoItem: (importJob) => ({
    id: importJob.getId(),
    baseURL: importJob.getBaseURL(),
    hashedApiKey: importJob.getHashedApiKey(),
    options: importJob.getOptions(),
    startTime: importJob.getStartTime(),
    endTime: importJob.getEndTime(),
    duration: importJob.getDuration(),
    status: importJob.getStatus(),
    urlCount: importJob.getUrlCount(),
    successCount: importJob.getSuccessCount(),
    failedCount: importJob.getFailedCount(),
    importQueueId: importJob.getImportQueueId(),
    initiatedBy: importJob.getInitiatedBy(),
    GSI1PK: 'ALL_IMPORT_JOBS',
  }),

  /**
   * Converts a DynamoDB item into an ImportJob object.
   * @param dynamoItem - The DynamoDB item to convert.
   * @return {Readonly<ImportJob>} The new ImportJob object.
   */
  fromDynamoItem: (dynamoItem) => {
    const importJobData = {
      id: dynamoItem.id,
      baseURL: dynamoItem.baseURL,
      hashedApiKey: dynamoItem.hashedApiKey,
      options: dynamoItem.options,
      startTime: dynamoItem.startTime,
      endTime: dynamoItem.endTime,
      duration: dynamoItem.duration,
      status: dynamoItem.status,
      urlCount: dynamoItem.urlCount,
      successCount: dynamoItem.successCount,
      failedCount: dynamoItem.failedCount,
      importQueueId: dynamoItem.importQueueId,
      initiatedBy: dynamoItem.initiatedBy,
    };

    return createImportJob(importJobData);
  },
};
