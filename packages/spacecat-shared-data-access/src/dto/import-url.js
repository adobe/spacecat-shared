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

import { createImportUrl } from '../models/importer/import-url.js';
import { convertDateToEpochSeconds, parseEpochToDate } from './dto-utils.js';

/**
 * The ImportUrlDto is a helper that can convert an ImportUrl object to a DynamoDB item and
 * vice versa.
 */
export const ImportUrlDto = {

  /**
   * Converts an ImportUrl object to a DynamoDB item.
   * @returns {object} The new DynamoDB item.
   */
  toDynamoItem: (importUrl) => ({
    id: importUrl.getId(),
    jobId: importUrl.getJobId(),
    url: importUrl.getUrl(),
    status: importUrl.getStatus(),
    reason: importUrl.getReason(),
    path: importUrl.getPath(),
    file: importUrl.getFile(),
    expiresAt: convertDateToEpochSeconds(importUrl.getExpiresAt()),
    urlNumber: importUrl.getUrlNumber(),
    totalUrlCount: importUrl.getTotalUrlCount(),
  }),

  /**
   * Converts a DynamoDB item into an ImportUrl object.
   * @param {object} dynamoItem - The DynamoDB item to convert.
   * @returns {ImportUrl} - The ImportUrl object.
   */
  fromDynamoItem: (dynamoItem) => {
    const importUrlData = {
      id: dynamoItem.id,
      jobId: dynamoItem.jobId,
      url: dynamoItem.url,
      status: dynamoItem.status,
      reason: dynamoItem.reason,
      path: dynamoItem.path,
      file: dynamoItem.file,
      expiresAt: parseEpochToDate(dynamoItem.expiresAt),
      urlNumber: dynamoItem.urlNumber,
      totalUrlCount: dynamoItem.totalUrlCount,
    };
    return createImportUrl(importUrlData);
  },
};
