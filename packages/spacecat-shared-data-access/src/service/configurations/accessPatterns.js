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

import { createConfiguration } from '../../models/configuration.js';
import { ConfigurationDto } from '../../dto/configuration.js';

export const getConfigurationByID = async (
  dynamoClient,
  config,
  configurationId,
) => {
  const dynamoItem = await dynamoClient.getItem(
    config.tableNameConfigurations,
    { id: configurationId },
  );

  return isObject(dynamoItem) ? ConfigurationDto.fromDynamoItem(dynamoItem) : null;
};

/**
 * Adds a configuration.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {object} configurationData - The configuration data.
 * @returns {Promise<Readonly<Configuration>>}
 */
export const addConfiguration = async (
  dynamoClient,
  config,
  log,
  configurationData,
) => {
  const configuration = createConfiguration(configurationData);

  await dynamoClient.putItem(
    config.tableNameConfigurations,
    ConfigurationDto.toDynamoItem(configuration),
  );

  return configuration;
};

/**
 * Updates a configuration.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {Configuration} configuration - The configuration.
 * @returns {Promise<Readonly<Configuration>>} - The updated configuration.
 */
export const updateConfiguration = async (
  dynamoClient,
  config,
  log,
  configuration,
) => {
  const existingConfiguration = await getConfigurationByID(
    dynamoClient,
    config,
    configuration.getId(),
  );

  if (!isObject(existingConfiguration)) {
    throw new Error('Configuration not found');
  }

  await dynamoClient.putItem(
    config.tableNameConfigurations,
    ConfigurationDto.toDynamoItem(configuration),
  );

  return configuration;
};

/**
 * Removes an configuration.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} configurationId - The ID of the configuration to remove.
 * @returns {Promise<void>}
 */
export const removeConfiguration = async (
  dynamoClient,
  config,
  log,
  configurationId,
) => {
  try {
    await dynamoClient.removeItem(config.tableNameConfigurations, { id: configurationId });
  } catch (error) {
    log.error(`Error removing configuration: ${error.message}`);
    throw error;
  }
};
