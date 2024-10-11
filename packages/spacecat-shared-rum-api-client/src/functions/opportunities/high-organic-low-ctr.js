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

const DAILY_EARNED_THRESHOLD = 5000;
const CTR_THRESHOLD_RATIO = 0.95;
const DAILY_PAGEVIEW_THRESHOLD = 1000;

function convertToOpportunity(traffic) {
  const {
    url, total, ctr, paid, owned, earned, siteAvgCTR,
  } = traffic;

  return {
    type: 'high-organic-low-ctr',
    page: url,
    screenshot: '',
    trackedPageKPIName: 'Click Through Rate',
    trackedPageKPIValue: ctr,
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
    }, {
      type: 'ctr',
      value: {
        page: ctr,
        siteAverage: siteAvgCTR,
      },
    }],
  };
}
function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;

  const dataChunks = new DataChunks();

  loadBundles(bundles, dataChunks);

  dataChunks.addFacet('urls', facets.url);

  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('clicks', (bundle) => (bundle.events.some((e) => e.checkpoint === 'click') ? bundle.weight : 0));

  const memo = {};
  dataChunks.addSeries('earned', trafficSeriesFn(memo, 'earned'));
  dataChunks.addSeries('owned', trafficSeriesFn(memo, 'owned'));
  dataChunks.addSeries('paid', trafficSeriesFn(memo, 'paid'));

  const siteAvgCTR = dataChunks.totals.clicks.sum / dataChunks.totals.views.sum;

  return dataChunks.facets.urls
    .filter((url) => url.metrics.views.sum > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter((url) => (
      (url.metrics.earned.sum + url.metrics.owned.sum) > DAILY_EARNED_THRESHOLD * interval))
    .filter((url) => (
      (url.metrics.clicks.sum / url.metrics.views.sum) < CTR_THRESHOLD_RATIO * siteAvgCTR))
    .map((url) => ({
      url: url.value,
      total: url.metrics.views.sum,
      earned: url.metrics.earned.sum,
      owned: url.metrics.owned.sum,
      paid: url.metrics.paid.sum,
      ctr: url.metrics.clicks.sum / url.metrics.views.sum,
      siteAvgCTR,
    }))
    .map(convertToOpportunity);
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
