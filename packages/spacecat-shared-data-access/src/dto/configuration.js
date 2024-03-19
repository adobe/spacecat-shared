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

import { createConfiguration } from '../models/configuration.js';

/**
 * Data transfer object for Configuration.
 */
export const ConfigurationDto = {
  /**
     * Converts a DynamoDB item into a Configuration object.
     * @param {object } dynamoItem - DynamoDB item.
     * @returns {Readonly<Configuration>} Configuration object.
     */
  fromDynamoItem: (dynamoItem) => {
    const configurationData = {
      version: dynamoItem.version,
      queues: dynamoItem.queues,
      jobs: dynamoItem.jobs,
    };

    return createConfiguration(configurationData);
  },

  /**
     * Converts a Configuration object into a DynamoDB item.
     * @param {Readonly<Configuration>} configuration - Configuration object.
     * @returns {object} DynamoDB item.
     */
  toDynamoItem: (configuration) => ({
    PK: 'ALL_CONFIGURATIONS',
    version: configuration.getVersion(),
    queues: configuration.getQueues(),
    jobs: configuration.getJobs(),
  }),
};
