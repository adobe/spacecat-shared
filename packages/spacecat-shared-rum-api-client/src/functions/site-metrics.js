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
 * Calculates pageviews, weighted average LCP, and user engagement.
 *
 * @param {Array} bundles - RUM bundles to process
 * @returns {Object} Aggregated metrics including pageviews, siteSpeed (LCP), and avgEngagement
 */
function handler(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // Add series for pageviews
  dataChunks.addSeries('pageviews', series.pageViews);

  // Add series for LCP (weighted average)
  dataChunks.addSeries('lcp', series.lcp);

  // Add series for engagement using evaluateEngagement
  dataChunks.addSeries('engagement', evaluateEngagement);

  // Extract totals
  const totalPageviews = dataChunks?.totals?.pageviews?.weight ?? 0;
  const lcpSum = dataChunks?.totals?.lcp?.sum ?? 0;
  const lcpCount = dataChunks?.totals?.lcp?.count ?? 0;
  const totalEngagedSessions = dataChunks?.totals?.engagement?.sum ?? 0;

  // Calculate weighted average LCP
  const avgLCP = lcpCount > 0 ? lcpSum / lcpCount : null;

  // Calculate engagement rate (users who clicked OR viewed 3+ content items)
  const avgEngagement = totalPageviews > 0
    ? (totalEngagedSessions / totalPageviews) * 100
    : null;

  return {
    pageviews: totalPageviews,
    siteSpeed: avgLCP, // LCP in milliseconds
    avgEngagement, // Engagement rate as percentage
  };
}

export default {
  handler,
  checkpoints: ['cwv-lcp', 'click', 'viewmedia', 'viewblock'],
};
