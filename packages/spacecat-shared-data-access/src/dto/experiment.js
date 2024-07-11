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

import { createExperiment } from '../models/experiment.js';

/**
 * Data transfer object for Experiment.
 */
export const ExperimentDto = {
  /**
   * Converts an Experiment object into a DynamoDB item.
   * @param {Readonly<Experiment>} experiment - Experiment object.
   * @returns {{siteId, id, name, url, status, type, startDate, endDate,
   * variants, updatedAt, updatedBy, conversionEventName, conversionEventValue}}
   */
  toDynamoItem: (experiment) => ({
    siteId: experiment.getSiteId(),
    id: experiment.getId(),
    name: experiment.getName(),
    url: experiment.getUrl(),
    status: experiment.getStatus(),
    type: experiment.getType(),
    startDate: experiment.getStartDate(),
    endDate: experiment.getEndDate(),
    variants: experiment.getVariants(),
    updatedAt: experiment.getUpdatedAt(),
    updatedBy: experiment.getUpdatedBy(),
    conversionEventName: experiment.getConversionEventName(),
    conversionEventValue: experiment.getConversionEventValue(),
    SK: `${experiment.getId()}#${experiment.getUrl()}}`,
  }),

  /**
   * Converts a DynamoDB item into Experiment object;
   * @param {object } dynamoItem - DynamoDB item.
   * @returns {Readonly<Experiment>} Experiment object.
   */
  fromDynamoItem: (dynamoItem) => {
    const experiment = {
      siteId: dynamoItem.siteId,
      id: dynamoItem.id,
      name: dynamoItem.name,
      status: dynamoItem.status,
      type: dynamoItem.type,
      startDate: dynamoItem.startDate,
      endDate: dynamoItem.endDate,
      variants: dynamoItem.variants,
      updatedAt: dynamoItem.updatedAt,
      updatedBy: dynamoItem.updatedBy,
      conversionEventName: dynamoItem.conversionEventName,
      conversionEventValue: dynamoItem.conversionEventValue,
    };

    return createExperiment(experiment);
  },
};
