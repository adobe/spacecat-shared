/*
 * Copyright 2026 Adobe. All rights reserved.
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
 * Runs an async mapper over items with a bounded number of concurrent executions.
 *
 * Results are returned in the same order as the input items (matching Promise.all
 * semantics). A worker-pool model is used so that a slow item never blocks items
 * in other lanes: as soon as one task finishes, the next queued item starts.
 *
 * The first rejection propagates (like Promise.all); use this only when a single
 * failure should abort the whole batch.
 *
 * @template T, R
 * @param {Array<T>} items - Items to process
 * @param {(item: T, index: number) => Promise<R>} mapper - Async mapper per item
 * @param {number} [concurrency=5] - Max number of tasks running at once
 * @returns {Promise<Array<R>>} - Results in input order
 */
export async function mapWithConcurrency(items, mapper, concurrency = 5) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, concurrency);
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
