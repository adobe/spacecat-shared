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

import { ApiKeyDto } from '../../dto/api-key.js';

/**
 * Get ApiKey by Hashed Key
 * @param {string} hashedKey
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @returns {Promise<ApiKeyDto>}
 */
export const getApiKeyByHashedKey = async (hashedKey, dynamoClient, log, config) => {
  const item = await dynamoClient.query({
    TableName: config.tableNameApiKeys,
    IndexName: config.indexNameApiKeyByHashedKey,
    KeyConditionExpression: '#hashedKey = :hashedKey',
    ExpressionAttributeNames: {
      '#hashedKey': 'hashedKey',
    },
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkApiKey,
      ':hashedKey': hashedKey,
    },
  });
  return item ? ApiKeyDto.fromDynamoItem(item) : null;
};

/**
 * Create new ApiKey
 * @param {ApiKey} apiKey
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @returns {Promise<ApiKeyDto>}
 */
export const createNewApiKey = async (apiKey, dynamoClient, config, log) => {
  const item = ApiKeyDto.toDynamoItem(apiKey);
  await dynamoClient.putItem(config.tableNameApiKeys, item, log);
  return item;
};
