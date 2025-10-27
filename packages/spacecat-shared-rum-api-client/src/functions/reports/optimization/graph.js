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
import {
  filterBundles,
  initializeDataChunks,
  extractMetrics,
  createTimeSeriesData,
  calculateTotals,
  validateDateRange,
} from './utils.js';

/**
 * Process URL-specific data
 * @param {Object} urlFacet - URL facet from DataChunks
 * @returns {Object} URL-specific data with totals and time series
 */
function processUrlData(urlFacet) {
  const urlBundles = urlFacet.entries;
  const urlDataChunks = initializeDataChunks(urlBundles, { includeDateFacet: true });

  return {
    total: extractMetrics(urlFacet),
    timeSeries: createTimeSeriesData(urlDataChunks.facets.date),
  };
}

/**
 * Process bundles into aggregated graph data
 * @param {Object[]} bundles - Array of RUM bundles
 * @returns {Object} Aggregated traffic data
 */
function processBundles(bundles) {
  const dataChunks = initializeDataChunks(bundles, {
    includeUrlFacet: true,
    includeDateFacet: true,
  });

  // Process URL-specific data
  const byUrl = {};
  if (dataChunks.facets.url) {
    dataChunks.facets.url.forEach((urlFacet) => {
      byUrl[urlFacet.value] = processUrlData(urlFacet);
    });
  }

  // Process overall traffic data
  const trafficData = createTimeSeriesData(dataChunks.facets.date);

  return { trafficData, byUrl };
}

/**
 * Main handler function to generate graph data
 * @param {Object[]} bundles - Array of RUM bundles
 * @param {Object} opts - Options object
 * @returns {Object}
 */
function handler(bundles, opts) {
  if (!opts) {
    return {
      trafficData: [],
      byUrl: {},
      totals: {},
      urlsFiltered: [],
      granularity: 'DAILY',
    };
  }

  const {
    startTime, endTime, urls = [],
  } = opts;

  validateDateRange(startTime, endTime);

  const filteredBundles = filterBundles(bundles, opts);
  const result = processBundles(filteredBundles);

  return {
    ...result,
    totals: calculateTotals(result.trafficData),
    urlsFiltered: urls,
    granularity: opts.granularity || 'DAILY',
  };
}

export default {
  handler,
};
