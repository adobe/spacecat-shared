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
 * Removes an item from a DynamoDB table.
 *
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {DynamoDbKey} key - The key object containing partitionKey and optionally sortKey.
 * @param {Logger} log - The logging object, defaults to console.
 * @returns {Promise<Object>} A promise that resolves to a message indicating successful removal.
 * @throws {Error} Throws an error if the DynamoDB delete operation fails or input validation fails.
 */
async function removeItem(docClient, tableName, key, log = console) {
  guardTableName(tableName);
  guardKey(key);

  const params = {
    TableName: tableName,
    Key: key,
  };

  try {
    const startTime = performance.now();

    await docClient.delete(params);

    const endTime = performance.now();
    const duration = endTime - startTime;

    log.info(`RemoveItem execution time: ${duration.toFixed(2)} ms for query: ${JSON.stringify(params)}`);

    return { message: 'Item removed successfully.' };
  } catch (error) {
    log.error('DB Remove Item Error:', error);
    throw error;
  }
}

export default removeItem;
