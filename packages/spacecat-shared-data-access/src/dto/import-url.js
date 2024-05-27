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

/**
 * Data Transfer Object for ImportUrl
 */

export const ImportUrlDto = {

  /**
     * Converts an importUrl object to a DynamoDB item
     */
  toDynamoItem: (importUrl) => ({
    id: importUrl.getId(),
    jobId: importUrl.getJobId(),
    baseURL: importUrl.getBaseURL(),
    options: importUrl.getOptions(),
    status: importUrl.getStatus(),
  }),

  /**
     * Converts a DynamoDB item into an ImportUrl object
     */
  fromDynamoItem: (dynamoItem) => {
    const importUrlData = {
      id: dynamoItem.id,
      jobId: dynamoItem.jobId,
      baseURL: dynamoItem.baseURL,
      options: dynamoItem.options,
      status: dynamoItem.status,
    };
    return createImportUrl(importUrlData);
  },
};
