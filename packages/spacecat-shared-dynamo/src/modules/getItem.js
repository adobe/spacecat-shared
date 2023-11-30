/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { performance } from 'perf_hooks';

import { guardKey, guardTableName } from '../utils/guards.js';

/**
 * Retrieves an item from DynamoDB using a table name and key object.
 *
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {object} key - The key object containing partitionKey and optionally sortKey.
 * @param {Logger} log - The logging object, defaults to console.
 * @returns {Promise<Object>} A promise that resolves to the retrieved item.
 * @throws {Error} Throws an error if the DynamoDB get operation fails or input validation fails.
 */
async function getItem(docClient, tableName, key, log = console) {
  guardTableName(tableName);
  guardKey(key);

  const params = {
    TableName: tableName,
    Key: key,
  };

  try {
    const startTime = performance.now();

    const data = await docClient.get(params);

    const endTime = performance.now();
    const duration = endTime - startTime;

    log.info(`GetItem execution time: ${duration.toFixed(2)} ms for query: ${JSON.stringify(params)}`);

    return data.Item;
  } catch (error) {
    log.error('DB Get Item Error:', error);
    throw error;
  }
}

export default getItem;
