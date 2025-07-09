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

import { classifyTrafficSource, extractTrafficHints } from '../common/traffic.js';

function getTrafficType(bundle, memo, referrer, utmSource, utmMedium, tracking) {
  const key = `${bundle.id}${bundle.url}${bundle.time}`;
  if (memo[key]) return memo[key];

  const type = classifyTrafficSource(
    bundle.url,
    referrer,
    utmSource,
    utmMedium,
    tracking,
  );

  // eslint-disable-next-line no-param-reassign
  memo[key] = type;
  return type;
}

async function handler(bundles) {
  const memo = {};

  const result = bundles.map((bundle) => {
    const {
      url, weight, referrer, utmSource, utmMedium, tracking,
    } = extractTrafficHints(bundle);

    const trafficType = getTrafficType(bundle, memo, referrer, utmSource, utmMedium, tracking);

    return {
      ...trafficType,
      url,
      weight,
      referrer,
      utmSource,
      utmMedium,
      device: bundle.userAgent,
      events: bundle.events,
    };
  });

  return result;
}

export default {
  handler,
};
