/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { urlMatchesFilter } from '@adobe/spacecat-shared-utils';
import { initializeDataChunks, calculateMetrics } from './utils/initialize.js';

function handler(bundles, opts) {
  // Handle null/undefined bundles
  let processedBundles = bundles;
  if (!bundles || !Array.isArray(bundles)) {
    processedBundles = [];
  }

  // Filter bundles by outlier URLs if provided
  let filteredBundles = processedBundles;
  if (opts && opts.outlierUrls && opts.outlierUrls.length > 0) {
    filteredBundles = processedBundles
      .filter((item) => !urlMatchesFilter(item.url, opts.outlierUrls));
  }

  // If urls filter is provided, keep only those URLs
  if (opts && opts.urls && opts.urls.length > 0) {
    filteredBundles = processedBundles.filter((item) => urlMatchesFilter(item.url, opts.urls));
  }

  const dataChunks = initializeDataChunks(filteredBundles);
  const result = calculateMetrics(dataChunks);
  return result;
}

export default {
  handler,
};
