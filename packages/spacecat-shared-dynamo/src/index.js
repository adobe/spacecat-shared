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

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Creates a client object for interacting with DynamoDB.
 *
 * @param {Object} log - The logging object, defaults to console.
 * @param {DynamoDB} dbClient - The AWS SDK DynamoDB client instance.
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @returns {Object} A client object with methods to interact with DynamoDB.
 */
const createClient = (
  log = console,
  dbClient = new DynamoDB(),
  docClient = DynamoDBDocumentClient.from(dbClient),
) => ({
  /**
   * Queries DynamoDB and automatically handles pagination to retrieve all items.
   *
   * @param {Object} originalParams - The parameters for the DynamoDB query.
   * @returns {Promise<Array>} A promise that resolves to an array of items retrieved from DynamoDB.
   * @throws {Error} Throws an error if the DynamoDB query operation fails.
   */
  async query(originalParams) {
    let items = [];
    const params = { ...originalParams };

    try {
      let data;
      do {
        /*
          This is one of the scenarios where it's appropriate to disable
          the ESLint rule for this specific case.
          In this case, it's necessary because each query depends on the
          result of the previous one (to get the LastEvaluatedKey).
         */
        // eslint-disable-next-line no-await-in-loop
        data = await docClient.query(params);
        items = items.concat(data.Items);
        params.ExclusiveStartKey = data.LastEvaluatedKey;
      } while (data.LastEvaluatedKey);
    } catch (error) {
      log.error('DB Query Error:', error);
      throw error;
    }
    return items;
  },

  /**
   * Retrieves an item from DynamoDB using a table name and key.
   *
   * @param {string} tableName - The name of the DynamoDB table.
   * @param {string} partitionKey - The partition key of the item to retrieve.
   * @param {string} [sortKey] - The sort key of the item to retrieve, if applicable.
   * @returns {Promise<Object>} A promise that resolves to the retrieved item.
   * @throws {Error} Throws an error if the DynamoDB get operation fails.
   */
  async getItem(tableName, partitionKey, sortKey) {
    const key = sortKey ? { partitionKey, sortKey } : { partitionKey };
    const params = {
      TableName: tableName,
      Key: key,
    };

    try {
      const data = await docClient.get(params);
      return data.Item;
    } catch (error) {
      log.error('DB Get Item Error:', error);
      throw error;
    }
  },

  /**
   * Inserts or updates an item in a DynamoDB table.
   *
   * @param {string} tableName - The name of the DynamoDB table.
   * @param {Object} item - The item to insert or update in the table.
   * @returns {Promise<Object>} A promise that resolves to a message indicating success.
   * @throws {Error} Throws an error if the DynamoDB put operation fails.
   */
  async putItem(tableName, item) {
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
  },

  /**
   * Removes an item from a DynamoDB table.
   *
   * @param {string} tableName - The name of the DynamoDB table.
   * @param {string} partitionKey - The partition key of the item to remove.
   * @param {string} [sortKey] - The sort key of the item to remove, if applicable.
   * @returns {Promise<Object>} A promise that resolves to a message indicating successful removal.
   * @throws {Error} Throws an error if the DynamoDB delete operation fails.
   */
  async removeItem(tableName, partitionKey, sortKey) {
    const key = sortKey ? { partitionKey, sortKey } : { partitionKey };
    const params = {
      TableName: tableName,
      Key: key,
    };

    try {
      await docClient.delete(params);
      return { message: 'Item removed successfully.' };
    } catch (error) {
      log.error('DB Remove Item Error:', error);
      throw error;
    }
  },
});

export { createClient };
