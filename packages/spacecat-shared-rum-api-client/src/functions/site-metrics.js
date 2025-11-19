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

import { DataChunks, series } from '@adobe/rum-distiller';
import { loadBundles } from '../utils.js';
import { evaluateEngagement } from './user-engagement.js';

/**
 * Handler to aggregate site-wide metrics from RUM bundles.
 * Calculates pageviews, P75 LCP, and user engagement.
 *
 * @param {Array} bundles - RUM bundles to process
 * @param {Object} opts - Options object
 * @param {Object} opts.log - Logger instance
 * @returns {Object} Aggregated metrics including pageviews, siteSpeed (LCP), and avgEngagement
 */
function handler(bundles, opts = {}) {
  const { log } = opts;

  if (log) {
    log.info(`[site-metrics] Processing ${bundles.length} bundles`);

    // Log unique dates and hours being processed
    const bundleDates = bundles.map((b) => {
      if (b.time) {
        return b.time.split('T')[0]; // Extract date part
      }
      return 'unknown';
    });
    const uniqueDates = [...new Set(bundleDates)].sort();
    log.info(`[site-metrics] Bundle dates: ${uniqueDates.join(', ')}`);

    // Log sample of first few bundle IDs
    const sampleBundles = bundles.slice(0, 5).map((b) => ({
      id: b.id,
      url: b.url,
      time: b.time,
      weight: b.weight,
    }));
    log.info(`[site-metrics] Sample bundles: ${JSON.stringify(sampleBundles)}`);
  }

  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // Add series for pageviews
  dataChunks.addSeries('pageviews', series.pageViews);

  // Add series for LCP (P75 percentile)
  dataChunks.addSeries('lcp', series.lcp);

  // Add series for engagement using evaluateEngagement
  dataChunks.addSeries('engagement', evaluateEngagement);

  // Extract totals
  const totalPageviews = dataChunks?.totals?.pageviews?.weight ?? 0;
  const lcpMetrics = dataChunks?.totals?.lcp;
  const totalEngagedSessions = dataChunks?.totals?.engagement?.sum ?? 0;

  // Calculate P75 LCP (75th percentile) - Core Web Vitals standard
  const p75LCP = lcpMetrics?.percentile ? lcpMetrics.percentile(75) : null;
  const lcpCount = lcpMetrics?.count ?? 0;

  if (log) {
    log.info(`[site-metrics] Results - Pageviews: ${totalPageviews}, LCP P75: ${p75LCP}, LCP Count: ${lcpCount}, Engaged: ${totalEngagedSessions}`);
  }

  // Calculate engagement rate (users who clicked OR viewed 4+ content items)
  const avgEngagement = totalPageviews > 0
    ? (totalEngagedSessions / totalPageviews) * 100
    : null;

  return {
    pageviews: totalPageviews,
    siteSpeed: p75LCP, // P75 LCP in milliseconds (Core Web Vitals standard)
    avgEngagement, // Engagement rate as percentage
  };
}

export default {
  handler,
  checkpoints: ['cwv-lcp', 'click', 'viewmedia', 'viewblock'],
};
