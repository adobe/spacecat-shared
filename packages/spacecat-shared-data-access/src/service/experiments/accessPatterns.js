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
 * Returns the experiment if exists in experiments table using siteId, experimentId and url
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} siteId - siteId of the experiment.
 * @param {string} id - id of the experiment.
 * @return the experiment if exists, null otherwise
 */
export const getExperiment = async (dynamoClient, config, siteId, experimentId, url) => {
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
  if (dynamoItems != null && dynamoItems.length > 0 && isObject(dynamoItems[0])) {
    return ExperimentDto.fromDynamoItem(dynamoItems[0]);
  }

  return null;
};

/**
 * Retrieves all experiments for a given siteId.
 * @param {*} dynamoClient - The DynamoDB client.
 * @param {*} config - The data access config.
 * @param {*} log  - the logger object
 * @param {*} siteId - siteId of the experiment.
 * @param {*} experimentId - experiment id.
 * @returns {Promise<ReadonlyArray<SiteCandidate>>} A promise that resolves to
 * an array of experiments
 */
export const getExperiments = async (
  dynamoClient,
  config,
  log,
  siteId,
  experimentId,
) => {
  const queryParams = {
    TableName: config.tableNameExperiments,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: { ':siteId': siteId },
    ScanIndexForward: false,
  };
  if (experimentId) {
    queryParams.KeyConditionExpression += ' AND begins_with(SK, :experimentId)';
    queryParams.ExpressionAttributeValues[':experimentId'] = experimentId;
  }
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
 * @returns {Promise<Readonly<SiteCandidate>>} A promise that resolves to newly created/updated
 * experiment
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

/**
 * Removes all given experiments.
 *
 * @param {DynamoDbClient} dynamoClient - the dynamo client.
 * @param {DataAccessConfig} config - the data access config.
 * @param {Logger} log - the logger.
 * @param {ReadonlyArray<SiteCandidate>} experiments - Array of experiments to be deleted
 * @returns {Promise<void>} - A promise that resolves when all key events are removed
 */
export const removeExperiments = async (
  dynamoClient,
  config,
  log,
  experiments,
) => {
  const tableName = config.tableNameExperiments;
  const removeExperimentPromises = experiments.map((experiment) => dynamoClient.removeItem(
    tableName,
    {
      id: experiment.getSiteId(),
      SK: `${experiment.getExperimentId()}#${experiment.getUrl()}`,
    },
  ));

  await Promise.all(removeExperimentPromises);
};
/**
 * Removes all experiments for a given site.
 *
 * @param {DynamoDbClient} dynamoClient - the dynamo client.
 * @param {DataAccessConfig} config - the data access config.
 * @param {Logger} log - the logger.
 * @param {String} siteId - ID of the site to remove experiments.
 */
export const removeExperimentsForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  try {
    const experiments = await getExperiments(dynamoClient, config, log, siteId);
    if (experiments != null && experiments.length > 0) {
      await removeExperiments(dynamoClient, config, log, experiments);
    }
  } catch (error) {
    log.error(`Error while removing experiments for site ${siteId}: ${error.message}`);
    throw error;
  }
};
