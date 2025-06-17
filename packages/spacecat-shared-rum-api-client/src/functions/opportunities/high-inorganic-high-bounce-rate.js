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

import { DataChunks, facets } from '@adobe/rum-distiller';
import { loadBundles, trafficSeriesFn } from '../../utils.js';

const HOMEPAGE_PAID_TRAFFIC_THRESHOLD = 0.8;
const NON_HOMEPAGE_PAID_TRAFFIC_THRESHOLD = 0.5;
const BOUNCE_RATE_THRESHOLD = 0.5;
const DAILY_PAGEVIEW_THRESHOLD = 1000;

function convertToOpportunity(traffic) {
  const {
    url, total, bounceRate, paid, earned, owned,
  } = traffic;

  return {
    type: 'high-inorganic-high-bounce-rate',
    page: url,
    screenshot: '',
    trackedPageKPIName: 'Bounce Rate',
    trackedPageKPIValue: bounceRate,
    trackedKPISiteAverage: '',
    pageViews: total,
    samples: total, // todo: get the actual number of samples
    metrics: [{
      type: 'traffic',
      value: {
        total,
        paid,
        owned,
        earned,
      },
    }],
  };
}

function hasHighInorganicTraffic(url, paid, total) {
  const isHomepage = new URL(url).pathname === '/';
  const threshold = isHomepage
    ? HOMEPAGE_PAID_TRAFFIC_THRESHOLD
    : NON_HOMEPAGE_PAID_TRAFFIC_THRESHOLD;
  return paid / total > threshold;
}

function handler(bundles, opts = {}) {
  const interval = 7;

  const dataChunks = new DataChunks();

  loadBundles(bundles, dataChunks);

  dataChunks.addFacet('urls', facets.url);

  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('clicks', (bundle) => (bundle.events.some((e) => e.checkpoint === 'click') ? bundle.weight : 0));

  const memo = {};
  dataChunks.addSeries('earned', trafficSeriesFn(memo, 'earned'));
  dataChunks.addSeries('owned', trafficSeriesFn(memo, 'owned'));
  dataChunks.addSeries('paid', trafficSeriesFn(memo, 'paid'));

  return dataChunks.facets.urls
    .filter((url) => {
      const hasEnoughViews = url.metrics.views.sum > interval * DAILY_PAGEVIEW_THRESHOLD;
      const isHighInorganic = hasHighInorganicTraffic(
        url.value,
        url.metrics.paid.sum,
        url.metrics.views.sum,
      );
      const bounceRate = 1 - url.metrics.clicks.sum / url.metrics.views.sum;
      const hasHighBounce = bounceRate < BOUNCE_RATE_THRESHOLD;
      const paidRatio = url.metrics.paid.sum / url.metrics.views.sum;
      const isHomepage = new URL(url.value).pathname === '/';
      const threshold = isHomepage ? HOMEPAGE_PAID_TRAFFIC_THRESHOLD : NON_HOMEPAGE_PAID_TRAFFIC_THRESHOLD;

      console.log(`
=== URL Analysis: ${url.value} ===
1. Pageview Check: ${hasEnoughViews ? 'PASS' : 'FAIL'}
   - Current views: ${url.metrics.views.sum}
   - Required views: ${interval * DAILY_PAGEVIEW_THRESHOLD}

2. Inorganic Traffic Check: ${isHighInorganic ? 'PASS' : 'FAIL'}
   - Paid traffic ratio: ${(paidRatio * 100).toFixed(2)}%
   - Required ratio: ${(threshold * 100).toFixed(2)}%
   - Is homepage: ${isHomepage}

3. Bounce Rate Check: ${hasHighBounce ? 'PASS' : 'FAIL'}
   - Current bounce rate: ${(bounceRate * 100).toFixed(2)}%
   - Required bounce rate: ${(BOUNCE_RATE_THRESHOLD * 100).toFixed(2)}%
   - Total views: ${url.metrics.views.sum}
   - Total clicks: ${url.metrics.clicks.sum}

Traffic Breakdown:
   - Paid traffic: ${url.metrics.paid.sum}
   - Earned traffic: ${url.metrics.earned.sum}
   - Owned traffic: ${url.metrics.owned.sum}

Final Status: ${(hasEnoughViews && isHighInorganic && hasHighBounce) ? 'SELECTED' : 'REJECTED'}
========================================
`);

      return hasEnoughViews && isHighInorganic && hasHighBounce;
    })
    .map((url) => ({
      url: url.value,
      total: url.metrics.views.sum,
      earned: url.metrics.earned.sum,
      owned: url.metrics.owned.sum,
      paid: url.metrics.paid.sum,
      bounceRate: 1 - url.metrics.clicks.sum / url.metrics.views.sum,
    }))
    .map(convertToOpportunity);
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
