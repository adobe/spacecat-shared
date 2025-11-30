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

/* c8 ignore start */

import { DataChunks, series } from '@adobe/rum-distiller';
import { loadBundles } from '../utils.js';

function handler(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  const campaignIdFacet = (bundle) => (bundle.events.some((e) => e.checkpoint === 'paid' && e.source === 'facebook')
    ? bundle.events.find((e) => e.checkpoint === 'utm' && e.source === 'utm_campaign')?.target
    : null);
  dataChunks.addFacet('traffic', campaignIdFacet);

  dataChunks.addSeries('ctr', (bundle) => (bundle.events.some((e) => e.checkpoint === 'click')
    ? bundle.weight
    : 0));
  dataChunks.addSeries('lcp', series.lcp);
  dataChunks.addSeries('views', series.pageViews);

  return dataChunks.facets.traffic.map((traffic) => {
    const campaignId = traffic.value;
    const { ctr, lcp, views } = traffic.metrics;

    return {
      campaignId,
      ctr: (ctr.sum / ctr.weight).toFixed(4),
      lcp: lcp.percentile(75),
      views: views.weight,
    };
  }).sort((a, b) => b.views - a.views);
}

export default {
  handler,
  checkpoints: [
    'click',
    'cwv-lcp',
    'utm',
    'paid',
    'email',
    'enter',
  ],
};
/* c8 ignore end */
