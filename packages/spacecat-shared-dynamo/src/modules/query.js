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

  let totalTime = 0;
  let paginationCount = 0;

  try {
    let data;
    do {
      const startTime = performance.now();

      /*
        This is one of the scenarios where it's appropriate to disable
        the ESLint rule for this specific case.
        In this case, it's necessary because each query depends on the
        result of the previous one (to get the LastEvaluatedKey).
       */
      // eslint-disable-next-line no-await-in-loop
      data = await docClient.query(params);

      const endTime = performance.now(); // End timing
      const duration = endTime - startTime;
      totalTime += duration;
      paginationCount += 1;

      log.info(`Pagination ${paginationCount} query time: ${duration.toFixed(2)} ms`);

      items = items.concat(data.Items);
      params.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (data.LastEvaluatedKey);
  } catch (error) {
    log.error('DB Query Error:', error);
    throw error;
  }

  log.info(`Total query time: ${totalTime.toFixed(2)} ms with ${paginationCount} paginations for query: ${JSON.stringify(params)}`);

  return items;
}

export default query;
