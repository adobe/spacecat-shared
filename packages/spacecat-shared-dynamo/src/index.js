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

import query from './modules/query.js';
import getItem from './modules/getItem.js';
import putItem from './modules/putItem.js';
import removeItem from './modules/removeItem.js';

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
  query: (params) => query(docClient, params, log),
  getItem: (tableName, key) => getItem(docClient, tableName, key, log),
  putItem: (tableName, item) => putItem(docClient, tableName, item, log),
  removeItem: (tableName, key) => removeItem(docClient, tableName, key, log),
});

export { createClient };
