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

function hasHighOrganicTraffic(interval, traffic) {
  const { earned } = traffic;
  return earned > DAILY_EARNED_THRESHOLD * interval;
}

function hasLowerCTR(ctr, siteAvgCTR) {
  return ctr < 0.95 * siteAvgCTR;
}

function handler(bundles, opts) {
  const { interval = 7 } = opts;

  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrl = getCTRByUrl(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl.filter(hasHighOrganicTraffic.bind(null, interval))
    .filter((traffic) => hasLowerCTR(ctrByUrl[traffic.url], siteAvgCTR));
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
