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
import { loadBundles } from '../../../../utils.js';

/**
 * Initialize DataChunks with common configuration
 * @param {Object[]} bundles - Array of RUM bundles
 * @returns {DataChunks} Configured DataChunks instance
 */
export function initializeDataChunks(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  const conversionSpec = { checkpoint: ['click'] };
  dataChunks.addFacet('url', facets.url, 'some', 'none');
  dataChunks.addFacet('checkpoint', facets.checkpoint, 'every', 'none');

  // Add metrics series
  dataChunks.addSeries('pageViews', series.pageViews);
  dataChunks.addSeries('engagement', series.engagement);
  dataChunks.addSeries('bounces', series.bounces);
  dataChunks.addSeries('organic', series.organic);
  dataChunks.addSeries('visits', series.visits);
  dataChunks.addSeries('conversions', (bundle) => (bundle && dataChunks.hasConversion(bundle, conversionSpec) ? bundle.weight : 0));
  dataChunks.addSeries('trafficData', (bundle) => ({
    date: bundle?.time || new Date().toISOString(),
    organic: series.organic(bundle) || 0,
    visits: series.visits(bundle) || 0,
    pageViews: series.pageViews(bundle) || 0,
    bounces: series.bounces(bundle) || 0,
    conversions: bundle && dataChunks.hasConversion(bundle, conversionSpec) ? bundle.weight : 0,
    engagement: series.engagement(bundle) || 0,
  }));

  return dataChunks;
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
