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
import { performance } from 'perf_hooks';

/**
 * Scans DynamoDB and automatically handles pagination to retrieve all items.
 *
 * @param {DynamoDBDocumentClient} docClient - The AWS SDK DynamoDB Document client instance.
 * @param {Object} originalParams - The parameters for the DynamoDB scan.
 * @param {Logger} log - The logging object, defaults to console.
 * @returns {Promise<Array>} A promise that resolves to an array of items retrieved from DynamoDB.
 * @throws {Error} Throws an error if the DynamoDB scan operation fails.
 */
async function scan(docClient, originalParams, log = console) {
  let items = [];
  const params = { ...originalParams };

  let totalTime = 0;
  let paginationCount = 0;

  try {
    let data;
    if (params.Limit && params.Limit <= 1) {
      const result = await docClient.scan(params);
      return result.Items;
    }
    do {
      const startTime = performance.now();

      // eslint-disable-next-line no-await-in-loop
      data = await docClient.scan(params);

      const endTime = performance.now(); // End timing
      const duration = endTime - startTime;
      totalTime += duration;
      paginationCount += 1;

      log.info(`Pagination ${paginationCount} scan time: ${duration.toFixed(2)} ms`);

      items = items.concat(data.Items);
      params.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (data.LastEvaluatedKey);
  } catch (error) {
    log.error('DB Scan Error:', error);
    throw error;
  }

  log.info(`Total scan time: ${totalTime.toFixed(2)} ms with ${paginationCount} paginations for scan: ${JSON.stringify(params)}`);

  return items;
}

export default scan;
