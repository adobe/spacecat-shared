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

function hasHighInorganicTraffic(traffic) {
  const { url, paid, total } = traffic;
  const isHomapage = new URL(url).pathname === '/';
  const threshold = isHomapage ? 0.5 : 0.8;
  return paid / total > threshold;
}

function hasHighBounceRate(ctr) {
  return ctr < 0.5;
}

function handler(bundles) {
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrl = getCTRByUrl(bundles);

  return trafficByUrl.filter(hasHighInorganicTraffic)
    .filter((traffic) => hasHighBounceRate(ctrByUrl[traffic.url]));
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
