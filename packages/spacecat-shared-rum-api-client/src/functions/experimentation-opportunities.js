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

import { pageviewsByUrl } from '../common/aggregateFns.js';

const PAGEVIEW_THRESHOLD = 14000;

function collectPaidTraffic(bundles) {
  return bundles.filter((bundle) => bundle.events.some((event) => event.checkpoint.startsWith('utm')))
    .reduce((acc, cur) => {
      if (!acc[cur.url]) acc[cur.url] = { paid: 0, converted: 0 };
      acc[cur.url].paid += cur.weight;
      if (cur.events.some((event) => event.checkpoint === 'click')) {
        acc[cur.url].converted += cur.weight;
      }
      return acc;
    }, {});
}

function handler(bundles) {
  const pageviews = pageviewsByUrl(bundles);
  const paidPageviews = collectPaidTraffic(bundles);

  const result = Object.entries(paidPageviews)
    .filter(([url]) => pageviews[url] > PAGEVIEW_THRESHOLD)
    .filter(([url, { paid, converted }]) => paid / pageviews[url] > 0.50 && converted / paid < 0.50)
    .map(([url, { paid, converted }]) => ({
      url,
      pageviews: pageviews[url],
      paid,
      paidBounceRate: (paid - converted) / paid,
    }));

  return result;
}

export default {
  handler,
  checkpoints: ['click', 'utm'],
};
