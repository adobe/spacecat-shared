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
import { DataChunks, series, facets } from '@adobe/rum-distiller';
import { computeConversionRate } from '@adobe/rum-distiller/utils.js';
import { urlMatchesFilter } from '@adobe/spacecat-shared-utils';
import { loadBundles } from '../../../utils.js';

// Constants
const METRIC_NAMES = ['organic', 'visits', 'pageViews', 'bounces', 'conversions', 'engagement'];
const CONVERSION_SPEC = { checkpoint: ['click'] };

/**
 * Create date facet function for YYYY-MM-DD format
 * @returns {Function} Date facet function
 */
function createDateFacet() {
  return (bundle) => {
    const date = new Date(bundle.time);
    return date.toISOString().split('T')[0];
  };
}

/**
 * Create conversion series function
 * @param {DataChunks} dataChunks - DataChunks instance
 * @returns {Function} Conversion series function
 */
function createConversionSeries(dataChunks) {
  return (bundle) => (bundle
    && dataChunks.hasConversion(bundle, CONVERSION_SPEC) ? bundle.weight : 0);
}

/**
 * Initialize DataChunks with common configuration
 * @param {Object[]} bundles - Array of RUM bundles
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeUrlFacet - Whether to include URL facet aggregation
 * @param {boolean} options.includeDateFacet - Whether to include date facet aggregation
 * @returns {DataChunks} Configured DataChunks instance
 */
export function initializeDataChunks(bundles, options = {}) {
  const { includeUrlFacet = false, includeDateFacet = false } = options;

  const dataChunks = new DataChunks();

  // Handle null/undefined bundles
  const validBundles = (!bundles || !Array.isArray(bundles)) ? [] : bundles;

  // Filter out bundles with missing or invalid URLs
  const processedBundles = validBundles.filter((bundle) => bundle && bundle.url);

  loadBundles(processedBundles, dataChunks);

  // Add checkpoint facet for conversion detection
  dataChunks.addFacet('checkpoint', facets.checkpoint, 'every', 'none');

  // Add URL facet if requested
  if (includeUrlFacet) {
    dataChunks.addFacet('url', facets.url, 'some', 'none');
  }

  // Add date facet if requested
  if (includeDateFacet) {
    dataChunks.addFacet('date', createDateFacet());
  }

  // Add metrics series
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('engagement', series.engagement);
  dataChunks.addSeries('bounces', series.bounces);
  dataChunks.addSeries('organic', series.organic);
  dataChunks.addSeries('visits', series.visits);
  dataChunks.addSeries('conversions', createConversionSeries(dataChunks));

  return dataChunks;
}

/**
 * Extract metrics from a facet
 * @param {Object} facet - DataChunks facet
 * @returns {Object} Metrics object
 */
export function extractMetrics(facet) {
  return METRIC_NAMES.reduce((acc, metric) => {
    acc[metric] = facet.metrics[metric]?.sum || 0;
    return acc;
  }, {});
}

/**
 * Create time series data from date facets
 * @param {Object[]} dateFacets - Array of date facets
 * @returns {Object[]} Sorted time series data
 */
export function createTimeSeriesData(dateFacets) {
  return dateFacets
    .map((facet) => ({
      date: facet.value,
      ...extractMetrics(facet),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Calculate metrics from a DataChunks instance
 * @param {DataChunks} chunk - DataChunks instance
 * @returns {Object} Calculated metrics
 */
export function calculateMetrics(chunk) {
  const t = chunk.totals;
  return {
    pageViews: { total: t.pageViews?.sum || 0 },
    visits: { total: t.visits?.sum || 0 },
    organicTraffic: { total: t.organic?.sum || 0 },
    bounces: {
      total: t.bounces?.sum || 0,
      rate: computeConversionRate(t.bounces?.sum || 0, t.visits?.sum || 0) || 0,
    },
    engagement: {
      total: t.engagement?.sum || 0,
      rate: computeConversionRate(t.conversions?.sum || 0, t.engagement?.sum || 0) || 0,
    },
    conversions: {
      total: t.conversions?.sum || 0,
      rate: computeConversionRate(t.conversions?.sum || 0, t.pageViews?.sum || 0) || 0,
    },
  };
}

/**
 * Calculate totals from time series data
 * @param {Object[]} timeSeriesData - Array of time series data points
 * @returns {Object} Totals object
 */
export function calculateTotals(timeSeriesData) {
  return timeSeriesData.reduce((acc, data) => {
    METRIC_NAMES.forEach((metric) => {
      acc[metric] += (data[metric] || 0);
    });
    return acc;
  }, METRIC_NAMES.reduce((acc, metric) => {
    acc[metric] = 0;
    return acc;
  }, {}));
}

/**
 * Filter bundles based on the outlierUrls and urls
 * @param {Object[]} bundles - Array of RUM bundles
 * @param {Object} opts - Options object
 * @param {string[]} opts.outlierUrls - URLs to exclude
 * @param {string[]} opts.urls - URLs to include
 * @returns {Object[]} Filtered bundles
 */
export function filterBundles(bundles, opts) {
  // Handle null/undefined opts
  const options = opts || {};

  const {
    outlierUrls,
    urls,
  } = options;

  let processedBundles = bundles;

  if (!bundles || !Array.isArray(bundles)) {
    processedBundles = [];
  }

  // Filter bundles by outlier URLs if provided
  let filteredBundles = processedBundles;
  if (outlierUrls && outlierUrls.length > 0) {
    filteredBundles = filteredBundles
      .filter((item) => item && item.url && !urlMatchesFilter(item.url, outlierUrls));
  }

  // If urls filter is provided, keep only those URLs
  if (urls && urls.length > 0) {
    filteredBundles = filteredBundles
      .filter((item) => item && item.url && urlMatchesFilter(item.url, urls));
  }
  return filteredBundles;
}
