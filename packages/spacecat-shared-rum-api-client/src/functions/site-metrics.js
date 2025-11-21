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
 * Calculates pageviews, P75 LCP, and user engagement.
 *
 * @param {Array} bundles - RUM bundles to process
 * @returns {Object} Aggregated metrics including:
 *   - pageviews: Total page views count
 *   - lcp: P75 LCP in milliseconds
 *   - engagementCount: Total engaged sessions count
 */
function handler(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // Add series for pageviews
  dataChunks.addSeries('pageviews', series.pageViews);

  // Add series for LCP (P75 percentile)
  dataChunks.addSeries('lcp', series.lcp);

  // Add series for engagement
  dataChunks.addSeries('engagement', series.engagement);

  return {
    pageviews: dataChunks?.totals?.pageviews?.sum ?? 0,
    lcp: dataChunks?.totals?.lcp?.percentile?.(75) ?? null,
    engagementCount: dataChunks?.totals?.engagement?.sum ?? 0,
  };
}

export default {
  handler,
  checkpoints: [],
};
