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
 * Queries DynamoDB and automatically handles pagination to retrieve all items.
 *
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @param {Object} originalParams - The parameters for the DynamoDB query.
 * @param {Logger} log - The logging object, defaults to console.
 * @returns {Promise<Array>} A promise that resolves to an array of items retrieved from DynamoDB.
 * @throws {Error} Throws an error if the DynamoDB query operation fails.
 */
async function query(docClient, originalParams, log = console) {
  let items = [];
  const params = { ...originalParams };

  try {
    let data;
    do {
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
}

export default query;
