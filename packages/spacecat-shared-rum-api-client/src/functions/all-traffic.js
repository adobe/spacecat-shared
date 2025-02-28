/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import trafficAcquisition from './traffic-acquisition.js';
import { getCTRByUrlAndType, getSiteAvgCTR } from '../common/aggregateFns.js';

function handler(bundles) {
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrlAndType = getCTRByUrlAndType(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl
    .map((traffic) => ({
      url: traffic.url,
      earned_traffic: traffic.earned,
      paid_traffic: traffic.paid,
      all_traffic: traffic.total,
      ctr: (ctrByUrlAndType[traffic.url].value)?.toFixed(2) || 0,
      siteAvgCtr: siteAvgCTR,
      earned_ctr: ctrByUrlAndType[traffic.url].types.earned || 0,
      paid_ctr: ctrByUrlAndType[traffic.url].types.paid || 0,
      owned_ctr: ctrByUrlAndType[traffic.url].types.owned || 0,
    }));
}

export default {
  handler,
};
