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
import { getCTRByUrl, getSiteAvgCTR } from '../../common/aggregateFns.js';

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

function hasHighOrganicTraffic(interval, traffic) {
  const { earned, owned } = traffic;
  return earned + owned > DAILY_EARNED_THRESHOLD * interval;
}

function hasLowerCTR(ctr, siteAvgCTR) {
  return ctr < CTR_THRESHOLD_RATIO * siteAvgCTR;
}

function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;

  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrl = getCTRByUrl(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl.filter((traffic) => traffic.total > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter(hasHighOrganicTraffic.bind(null, interval))
    .filter((traffic) => hasLowerCTR(ctrByUrl[traffic.url], siteAvgCTR))
    .map((traffic) => ({ ...traffic, ctr: ctrByUrl[traffic.url], siteAvgCTR }))
    .map(convertToOpportunity);
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
