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
import { createExperiment } from '../../models/experiment.js';
import { ExperimentDto } from '../../dto/experiment.js';

/**
 * Checks if an experiment exists in experiments table using siteId and experimentId
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} siteId - siteId of the experiment.
 * @param {string} id - id of the experiment.
 * @return {Promise<Readonly<Boolean>>} A promise that resolves to true if the experiment exist
 */
export const exists = async (dynamoClient, config, siteId, experimentId, url) => {
  const queryParams = {
    TableName: config.tableNameExperiments,
    KeyConditionExpression: 'siteId = :siteId AND SK = :SK',
    ExpressionAttributeValues: {
      ':siteId': siteId,
      ':SK': `${experimentId}#${url}`,
    },
    ScanIndexForward: false,
  };
  const dynamoItems = await dynamoClient.query(queryParams);

  return dynamoItems != null && dynamoItems.length > 0 && isObject(dynamoItems[0]);
};

export const getExperiments = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  const queryParams = {
    TableName: config.tableNameExperiments,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: { ':siteId': siteId },
    ScanIndexForward: false,
  };
  const dynamoItems = await dynamoClient.query(queryParams);

  return dynamoItems.map((item) => ExperimentDto.fromDynamoItem(item));
};

/**
 * Upserts an experiment.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {object} log - the logger object
 * @param {object} experimentData - The experiment data.
 * @returns {Promise<Readonly<SiteCandidate>>} newly created/updated
 * experiment if hadn't created before
 */
export const upsertExperiment = async (
  dynamoClient,
  config,
  log,
  experimentData,
) => {
  const experiment = createExperiment(experimentData);
  await dynamoClient.putItem(
    config.tableNameExperiments,
    ExperimentDto.toDynamoItem(experiment),
  );

  return experiment;
};
