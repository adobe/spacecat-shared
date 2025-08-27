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
import { loadBundles } from '../../../utils.js';
import { filterBundles } from './utils.js';

/**
 * Validate date range
 * @param {string} startTime
 * @param {string} endTime
 */
function validateDateRange(startTime, endTime) {
  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    throw new Error('Start time must be before end time');
  }
}

/**
 * Initialize DataChunks with date-based aggregation
 * @param {Object[]} bundles - Array of RUM bundles
 * @param {Object} opts - Options object
 * @returns {DataChunks} Configured DataChunks instance
 */
function initializeDataChunksWithDateAggregation(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  const conversionSpec = { checkpoint: ['click'] };

  dataChunks.addFacet('checkpoint', facets.checkpoint, 'every', 'none');
  dataChunks.addFacet('url', facets.url, 'some', 'none');

  // Aggregate by date only
  dataChunks.addFacet('date', (bundle) => {
    const date = new Date(bundle.time);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  });

  // Add metrics series
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('engagement', series.engagement);
  dataChunks.addSeries('bounces', series.bounces);
  dataChunks.addSeries('organic', series.organic);
  dataChunks.addSeries('visits', series.visits);
  dataChunks.addSeries('conversions', (bundle) => (bundle && dataChunks.hasConversion(bundle, conversionSpec) ? bundle.weight : 0));

  return dataChunks;
}

/**
 * Initialize DataChunks for URL-specific aggregation
 * @param {Object[]} bundles - Array of RUM bundles for a specific URL
 * @returns {DataChunks} Configured DataChunks instance
 */
function initializeDataChunksForUrl(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  const conversionSpec = { checkpoint: ['click'] };

  // Add checkpoint facet for conversion detection
  dataChunks.addFacet('checkpoint', facets.checkpoint, 'every', 'none');

  // Aggregate by date only
  dataChunks.addFacet('date', (bundle) => {
    const date = new Date(bundle.time);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  });

  // Add metrics series
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('engagement', series.engagement);
  dataChunks.addSeries('bounces', series.bounces);
  dataChunks.addSeries('organic', series.organic);
  dataChunks.addSeries('visits', series.visits);
  dataChunks.addSeries('conversions', (bundle) => (bundle && dataChunks.hasConversion(bundle, conversionSpec) ? bundle.weight : 0));

  return dataChunks;
}

/**
 * Process bundles into aggregated graph data
 * @param {Object[]} bundles - Array of RUM bundles
 * @param {Object} opts - Options object
 * @returns {Object} Aggregated traffic data
 */
function processBundles(bundles) {
  const dataChunks = initializeDataChunksWithDateAggregation(bundles);

  let trafficData = [];
  const byUrl = {};

  // Process URL-specific data
  if (dataChunks.facets.url) {
    dataChunks.facets.url.forEach((urlFacet) => {
      const url = urlFacet.value;
      // Get bundles for this specific URL
      const urlBundles = urlFacet.entries;

      // Create separate DataChunks for this URL to get URL-specific time series
      const urlDataChunks = initializeDataChunksForUrl(urlBundles);

      byUrl[url] = {
        total: {
          organic: urlFacet.metrics.organic?.sum || 0,
          visits: urlFacet.metrics.visits?.sum || 0,
          pageViews: urlFacet.metrics.pageViews?.sum || 0,
          bounces: urlFacet.metrics.bounces?.sum || 0,
          conversions: urlFacet.metrics.conversions?.sum || 0,
          engagement: urlFacet.metrics.engagement?.sum || 0,
        },
        timeSeries: [],
      };

      // Add time series data for this URL
      const urlDailyData = urlDataChunks.facets.date
        .map((facet) => ({
          date: facet.value,
          organic: facet.metrics.organic?.sum || 0,
          visits: facet.metrics.visits?.sum || 0,
          pageViews: facet.metrics.pageViews?.sum || 0,
          bounces: facet.metrics.bounces?.sum || 0,
          conversions: facet.metrics.conversions?.sum || 0,
          engagement: facet.metrics.engagement?.sum || 0,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      byUrl[url].timeSeries = urlDailyData;
    });
  }

  // Process overall traffic data
  trafficData = dataChunks.facets.date.map((facet) => ({
    date: facet.value,
    organic: facet.metrics.organic?.sum || 0,
    visits: facet.metrics.visits?.sum || 0,
    pageViews: facet.metrics.pageViews?.sum || 0,
    bounces: facet.metrics.bounces?.sum || 0,
    conversions: facet.metrics.conversions?.sum || 0,
    engagement: facet.metrics.engagement?.sum || 0,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

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
      timePeriod: { startTime: null, endTime: null },
      trafficData: [],
      byUrl: {},
      totals: {},
    };
  }

  const {
    startTime, endTime, urls = [],
  } = opts;

  validateDateRange(startTime, endTime);

  const filteredBundles = filterBundles(bundles, opts);
  const result = processBundles(filteredBundles);

  // Calculate totals from trafficData
  const totals = result.trafficData.reduce((acc, data) => ({
    organic: acc.organic + (data.organic || 0),
    visits: acc.visits + (data.visits || 0),
    pageViews: acc.pageViews + (data.pageViews || 0),
    bounces: acc.bounces + (data.bounces || 0),
    conversions: acc.conversions + (data.conversions || 0),
    engagement: acc.engagement + (data.engagement || 0),
  }), {
    organic: 0,
    visits: 0,
    pageViews: 0,
    bounces: 0,
    conversions: 0,
    engagement: 0,
  });

  return {
    ...result,
    totals,
    urlsFiltered: urls || [],
    granularity: opts.granularity || 'DAILY',
  };
}

export default {
  handler,
};
