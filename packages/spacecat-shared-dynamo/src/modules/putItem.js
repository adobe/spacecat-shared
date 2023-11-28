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

/**
 * Inserts or updates an item in a DynamoDB table.
 *
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {Object} item - The item to insert or update in the table.
 * @param {Logger} log - The logging object, defaults to console.
 * @returns {Promise<Object>} A promise that resolves to a message indicating success.
 * @throws {Error} Throws an error if the DynamoDB put operation fails.
 */
async function putItem(docClient, tableName, item, log = console) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Invalid tableName: must be a non-empty string.');
  }

  const params = {
    TableName: tableName,
    Item: item,
  };

  try {
    await docClient.put(params);
    return { message: 'Item inserted/updated successfully.' };
  } catch (error) {
    log.error('DB Put Item Error:', error);
    throw error;
  }
}

export default putItem;
