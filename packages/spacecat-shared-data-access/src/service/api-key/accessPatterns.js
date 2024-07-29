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
 * Get ApiKey by ID
 * @param {string} id
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @returns {Promise<ApiKeyDto>}
 */
export const getApiKeyById = async (id, dynamoClient, config, log) => {
  const item = await dynamoClient.getItem(config.tableNameApiKeys, { id }, log);
  return ApiKeyDto.fromDynamoItem(item);
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
