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
import { urlMatchesFilter } from '@adobe/spacecat-shared-utils';
import { loadBundles } from '../../../utils.js';

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
 * @param {string} granularity - Granularity (DAILY/HOURLY)
 * @param {string[]} filterUrls - URLs to filter by
 * @returns {DataChunks} Configured DataChunks instance
 */
function initializeDataChunksWithDateAggregation(bundles, granularity = 'DAILY') {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  const conversionSpec = { checkpoint: ['click'] };

  // Add facets
  dataChunks.addFacet('checkpoint', facets.checkpoint, 'every', 'none');

  // Add URL facet for filtering and categorization
  dataChunks.addFacet('url', facets.url, 'some', 'none');

  // Add date facet based on granularity
  if (granularity.toUpperCase() === 'HOURLY') {
    // For hourly: aggregate by date and hour
    dataChunks.addFacet('dateHour', (bundle) => {
      const date = new Date(bundle.time);
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hour = date.getUTCHours().toString().padStart(2, '0');
      return `${year}-${month}-${day}-${hour}`;
    });
  } else {
    // For daily: aggregate by date only
    dataChunks.addFacet('date', (bundle) => {
      const date = new Date(bundle.time);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    });
  }

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
 * @param {string} granularity - Granularity (DAILY/HOURLY)
 * @param {string[]} filterUrls - URLs to filter by
 * @returns {Object} Aggregated traffic data
 */
function processBundles(bundles, granularity = 'DAILY', filterUrls = []) {
  const dataChunks = initializeDataChunksWithDateAggregation(bundles, granularity);

  let trafficData = [];
  const byUrl = {};

  // Process URL-specific data
  if (dataChunks.facets.url) {
    dataChunks.facets.url.forEach((urlFacet) => {
      const url = urlFacet.value;

      // Skip if not in filter URLs (if filter is applied)
      // This condition ensures we have filter URLs and the URL doesn't match any filter
      if (filterUrls && filterUrls.length > 0 && !urlMatchesFilter(url, filterUrls)) {
        return; // Skip this URL facet as it doesn't match the filter criteria
      }

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
      if (granularity.toUpperCase() === 'HOURLY') {
        // For hourly: include hour information
        const urlHourlyData = dataChunks.facets.dateHour
          .filter(() => true)
          .map((facet) => {
            const parts = facet.value.split('-');
            const [year, month, day, hour] = parts;

            return {
              date: `${year}-${month}-${day}`,
              hour: parseInt(hour, 10),
              organic: facet.metrics.organic?.sum || 0,
              visits: facet.metrics.visits?.sum || 0,
              pageViews: facet.metrics.pageViews?.sum || 0,
              bounces: facet.metrics.bounces?.sum || 0,
              conversions: facet.metrics.conversions?.sum || 0,
              engagement: facet.metrics.engagement?.sum || 0,
            };
          })
          .sort((a, b) => {
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison !== 0) return dateComparison;
            return a.hour - b.hour;
          });

        byUrl[url].timeSeries = urlHourlyData;
      } else {
        // For daily: date-only format
        const urlDailyData = dataChunks.facets.date
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
      }
    });
  }

  // Process overall traffic data (filtered by URLs if specified)
  if (granularity.toUpperCase() === 'HOURLY') {
    // For hourly: include hour information
    trafficData = dataChunks.facets.dateHour.map((facet) => {
      const parts = facet.value.split('-');
      const [year, month, day, hour] = parts;

      return {
        date: `${year}-${month}-${day}`,
        hour: parseInt(hour, 10),
        organic: facet.metrics.organic?.sum || 0,
        visits: facet.metrics.visits?.sum || 0,
        pageViews: facet.metrics.pageViews?.sum || 0,
        bounces: facet.metrics.bounces?.sum || 0,
        conversions: facet.metrics.conversions?.sum || 0,
        engagement: facet.metrics.engagement?.sum || 0,
      };
    }).sort((a, b) => {
      // Sort by date first, then by hour
      const dateComparison = new Date(a.date) - new Date(b.date);
      if (dateComparison !== 0) return dateComparison;
      return a.hour - b.hour;
    });
  } else {
    // For daily: date-only format
    trafficData = dataChunks.facets.date.map((facet) => ({
      date: facet.value,
      organic: facet.metrics.organic?.sum || 0,
      visits: facet.metrics.visits?.sum || 0,
      pageViews: facet.metrics.pageViews?.sum || 0,
      bounces: facet.metrics.bounces?.sum || 0,
      conversions: facet.metrics.conversions?.sum || 0,
      engagement: facet.metrics.engagement?.sum || 0,
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

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
    startTime, endTime, urls = [], outlierUrls = [], granularity = 'DAILY',
  } = opts;

  // Handle null/undefined bundles
  let processedBundles = bundles;
  if (!bundles || !Array.isArray(bundles)) {
    processedBundles = [];
  }

  // Filter bundles by outlier URLs if provided
  let filteredBundles = processedBundles;
  if (outlierUrls && outlierUrls.length > 0) {
    filteredBundles = processedBundles.filter((item) => !urlMatchesFilter(item.url, outlierUrls));
  }

  if (urls && urls.length > 0) {
    filteredBundles = processedBundles;
  }

  validateDateRange(startTime, endTime);
  const result = processBundles(filteredBundles, granularity, urls);

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

  // Add granularity info to response
  return {
    ...result,
    granularity,
    totals,
    urlsFiltered: urls || [],
  };
}

export default {
  handler,
};
