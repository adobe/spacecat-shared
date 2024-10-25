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

import trafficAcquisition from '../traffic-acquisition.js';
import { getCTRByUrl } from '../../common/aggregateFns.js';

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

function hasHighInorganicTraffic(traffic) {
  const { url, paid, total } = traffic;
  const isHomepage = new URL(url).pathname === '/';
  const threshold = isHomepage
    ? HOMEPAGE_PAID_TRAFFIC_THRESHOLD
    : NON_HOMEPAGE_PAID_TRAFFIC_THRESHOLD;
  return paid / total > threshold;
}

function hasHighBounceRate(ctr) {
  return ctr < BOUNCE_RATE_THRESHOLD;
}

function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrl = getCTRByUrl(bundles);

  return trafficByUrl.filter((traffic) => traffic.total > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter(hasHighInorganicTraffic)
    .filter((traffic) => hasHighBounceRate(ctrByUrl[traffic.url]))
    .map((traffic) => ({ ...traffic, bounceRate: 1 - ctrByUrl[traffic.url] }))
    .map(convertToOpportunity);
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
