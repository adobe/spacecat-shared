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
  isInteger,
  isObject,
} from '@adobe/spacecat-shared-utils';

import { ConfigurationDto } from '../../dto/configuration.js';
import { createConfiguration } from '../../models/configuration.js';

/**
 * Retrieves configuration with latest version.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @returns {Promise<Readonly<Configuration>>} A promise that resolves to the configuration
 * object if found, otherwise null.
 */
export const getConfiguration = async (
  dynamoClient,
  config,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameConfigurations,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': config.pkAllConfigurations,
    },
    Limit: 1,
    ScanIndexForward: false, // Sorts ascending if true, descending if false
  });

  if (dynamoItems.length === 0) return null;
  return ConfigurationDto.fromDynamoItem(dynamoItems[0]);
};

/**
 * Retrieves all configurations.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @return {Promise<Readonly<Configuration>[]>} A promise that resolves to the configurations.
 */
export const getConfigurations = async (
  dynamoClient,
  config,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameConfigurations,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': config.pkAllConfigurations,
    },
  });

  return dynamoItems.map(ConfigurationDto.fromDynamoItem);
};

/**
 * Retrieves a site by its version.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} version - The version of the configuration to retrieve.
 * @returns {Promise<Readonly<Configuration>|null>} A promise that resolves to the configuration
 * object if found, otherwise null.
 */
export const getConfigurationByVersion = async (
  dynamoClient,
  config,
  version,
) => {
  const dynamoItem = await dynamoClient.getItem(config.tableNameConfigurations, {
    PK: config.pkAllConfigurations,
    version,
  });

  return isObject(dynamoItem) ? ConfigurationDto.fromDynamoItem(dynamoItem) : null;
};

function incrementVersion(version) {
  if (!isInteger(version)) return 1;

  const versionNumber = parseInt(version, 10);
  return versionNumber + 1;
}

/**
 * Updates the configuration. Updating the configuration will create a new version of the
 * configuration. The version is a string of the format "v<version-number>", for example "v1".
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
  * @param {Configuration} configurationData - The configuration data.
 * @return {Promise<void>} A promise that resolves when the configuration is updated.
 */
export const updateConfiguration = async (
  dynamoClient,
  config,
  configurationData,
) => {
  const newConfigurationData = { ...configurationData };
  const latestConfiguration = await getConfiguration(dynamoClient, config);

  newConfigurationData.version = incrementVersion(latestConfiguration?.getVersion());

  const newConfiguration = createConfiguration(newConfigurationData);

  await dynamoClient.putItem(
    config.tableNameConfigurations,
    ConfigurationDto.toDynamoItem(newConfiguration),
  );

  return newConfiguration;
};
