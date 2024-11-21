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
import { createApiKey } from '../../models/api-key/api-key.js';

/**
 * Get ApiKey by Hashed Key
 * @param {string} hashedApiKey
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @returns {Promise<ApiKey>}
 */
export const getApiKeyByHashedApiKey = async (hashedApiKey, dynamoClient, log, config) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameApiKeys,
    IndexName: config.indexNameApiKeyByHashedApiKey,
    KeyConditionExpression: '#hashedApiKey = :hashedApiKey',
    ExpressionAttributeNames: {
      '#hashedApiKey': 'hashedApiKey',
    },
    ExpressionAttributeValues: {
      ':hashedApiKey': hashedApiKey,
    },
    Limit: 1,
  });
  return items.length > 0 ? ApiKeyDto.fromDynamoItem(items[0]) : null;
};

/**
 * Create new ApiKey
 * @param {ApiKey} apiKey
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @returns {Promise<ApiKey>}
 */
export const createNewApiKey = async (apiKey, dynamoClient, config, log) => {
  const item = createApiKey(apiKey);
  await dynamoClient.putItem(config.tableNameApiKeys, ApiKeyDto.toDynamoItem(item), log);
  return item;
};

/**
 * Get ApiKeys by IMS User ID and IMS Org ID
 * @param imsUserId
 * @param imsOrgId
 * @param dynamoClient
 * @param config
 * @returns {Promise<ApiKey[]>}
 */
export const getApiKeysByImsUserIdAndImsOrgId = async (
  imsUserId,
  imsOrgId,
  dynamoClient,
  config,
) => {
  const items = await dynamoClient.query({
    TableName: config.tableNameApiKeys,
    IndexName: config.indexNameApiKeyByImsUserIdAndImsOrgId,
    KeyConditionExpression: '#imsUserId = :imsUserId AND #imsOrgId = :imsOrgId',
    ExpressionAttributeNames: {
      '#imsUserId': 'imsUserId',
      '#imsOrgId': 'imsOrgId',
    },
    ExpressionAttributeValues: {
      ':imsUserId': imsUserId,
      ':imsOrgId': imsOrgId,
    },
  });
  return items.map((item) => ApiKeyDto.fromDynamoItem(item));
};

/**
 * Get ApiKey by ID
 * @param id
 * @param dynamoClient
 * @param config
 * @returns {Promise<ApiKey|null>}
 */
export const getApiKeyById = async (id, dynamoClient, config) => {
  const item = await dynamoClient.getItem(config.tableNameApiKeys, { id });
  return item ? ApiKeyDto.fromDynamoItem(item) : null;
};

/**
 * Update ApiKey
 * @param apiKey
 * @param dynamoClient
 * @param config
 * @returns {Promise<ApiKey>}
 */
export const updateApiKey = async (apiKey, dynamoClient, config) => {
  const existingApiKey = await getApiKeyById(apiKey.getId(), dynamoClient, config);
  if (!existingApiKey) {
    throw new Error(`API Key with id ${apiKey.getId()} not found`);
  }
  await dynamoClient.putItem(config.tableNameApiKeys, ApiKeyDto.toDynamoItem(apiKey));
  return apiKey;
};
