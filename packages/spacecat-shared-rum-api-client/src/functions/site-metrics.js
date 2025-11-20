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

/**
 * Handler to aggregate site-wide metrics from RUM bundles.
 * Calculates pageviews, P75 LCP, user engagement, and conversions.
 *
 * @param {Array} bundles - RUM bundles to process
 * @param {Object} opts - Options object
 * @param {Object} opts.log - Logger instance
 * @returns {Object} Aggregated metrics including:
 *   - pageviews: Total page views count
 *   - siteSpeed: P75 LCP in milliseconds
 *   - avgEngagement: Engagement rate as percentage
 *   - engagementCount: Total engaged sessions count
 *   - conversions: Total conversions count (bundles with click events)
 *   - conversionRate: Conversion rate as percentage
 */
function handler(bundles, opts = {}) {
  const { log } = opts;

  if (log) {
    log.info(`[site-metrics] Processing ${bundles.length} bundles`);

    // Log unique dates being processed
    const bundleDates = bundles.map((b) => (b.time ? b.time.split('T')[0] : 'unknown'));
    const uniqueDates = [...new Set(bundleDates)].sort();
    log.info(`[site-metrics] Bundle dates: ${uniqueDates.join(', ')}`);

    // Log first and last bundle timestamps (actual data range)
    const bundlesWithTime = bundles
      .filter((b) => b.time)
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    if (bundlesWithTime.length > 0) {
      const firstBundle = bundlesWithTime[0];
      const lastBundle = bundlesWithTime[bundlesWithTime.length - 1];
      log.info(`[site-metrics] First bundle time (nearest to startTime): ${firstBundle.time}`);
      log.info(`[site-metrics] Last bundle time (nearest to endTime): ${lastBundle.time}`);
      log.info(`[site-metrics] Actual data range: ${firstBundle.time} to ${lastBundle.time}`);
    }

    // Log unique URLs from bundles
    const uniqueUrls = [...new Set(bundles.map((b) => b.url))];
    log.info(`[site-metrics] Total unique bundle URLs: ${uniqueUrls.length}`);

    // Log bundle weights summary
    const totalWeight = bundles.reduce((sum, b) => sum + (b.weight || 0), 0);
    const avgWeight = totalWeight / bundles.length;
    log.info(`[site-metrics] Bundle weights - total: ${totalWeight}, avg: ${avgWeight.toFixed(2)}, bundles: ${bundles.length}`);
  }

  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // Add series for pageviews
  dataChunks.addSeries('pageviews', series.pageViews);

  // Add series for LCP (P75 percentile)
  dataChunks.addSeries('lcp', series.lcp);

  // Add series for engagement using our custom evaluateEngagement
  dataChunks.addSeries('engagement', series.engagement);

  // Add series for conversions (default: bundles with click events)
  dataChunks.addSeries('conversions', (bundle) => (bundle.events?.some((e) => e.checkpoint === 'click')
    ? bundle.weight
    : 0));

  // Extract totals
  const totalPageviews = dataChunks?.totals?.pageviews?.sum ?? 0;
  const totalEngagedSessions = dataChunks?.totals?.engagement?.sum ?? 0;
  const totalConversions = dataChunks?.totals?.conversions?.sum ?? 0;

  // Calculate P75 LCP (75th percentile) - Core Web Vitals standard
  const lcpMetrics = dataChunks?.totals?.lcp;
  const p75LCP = lcpMetrics?.percentile?.(75) ?? null;
  const lcpCount = lcpMetrics?.count ?? 0;

  if (log) {
    log.info(`[site-metrics] LCP Metrics Debug - count: ${lcpCount}, mean: ${lcpMetrics?.mean}, p75: ${p75LCP}, values length: ${lcpMetrics?.values?.length}`);
  }

  if (log) {
    log.info(`[site-metrics] Results - Pageviews: ${totalPageviews}, LCP P75: ${p75LCP}, LCP Count: ${lcpCount}, Engaged: ${totalEngagedSessions}, Conversions: ${totalConversions}`);
  }

  // Calculate engagement rate (users who clicked)
  const avgEngagement = totalPageviews > 0
    ? (totalEngagedSessions / totalPageviews) * 100
    : null;

  // Calculate conversion rate
  const conversionRate = totalPageviews > 0
    ? (totalConversions / totalPageviews) * 100
    : null;

  return {
    pageviews: totalPageviews,
    siteSpeed: p75LCP, // P75 LCP in milliseconds (Core Web Vitals standard)
    avgEngagement, // Engagement rate as percentage
    engagementCount: totalEngagedSessions, // Total engaged sessions count
    conversions: totalConversions, // Total conversions count
    conversionRate, // Conversion rate as percentage
  };
}

export default {
  handler,
  checkpoints: [],
};
