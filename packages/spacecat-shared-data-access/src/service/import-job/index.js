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

import {
  createNewImportJob,
  getImportJobByID,
  getImportJobsByStatus,
  updateImportJob,
  getImportJobsByDateRange,
  removeImportJob,
} from './accessPatterns.js';

export const importJobFunctions = (dynamoClient, config, log) => ({
  getImportJobsByDateRange: (startDate, endDate) => getImportJobsByDateRange(
    dynamoClient,
    config,
    log,
    startDate,
    endDate,
  ),
  getImportJobByID: (id) => getImportJobByID(
    dynamoClient,
    config,
    log,
    id,
  ),
  getImportJobsByStatus: (status) => getImportJobsByStatus(
    dynamoClient,
    config,
    log,
    status,
  ),
  createNewImportJob: (importJobData) => createNewImportJob(
    dynamoClient,
    config,
    log,
    importJobData,
  ),
  updateImportJob: (importJob) => updateImportJob(
    dynamoClient,
    config,
    log,
    importJob,
  ),
  removeImportJob: (importJob) => removeImportJob(
    dynamoClient,
    config,
    log,
    importJob,
  ),
});
