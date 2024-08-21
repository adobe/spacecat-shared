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

/* eslint-disable */

/* c8 ignore start */
const PAGEVIEW_THRESHOLD = 5000;

/*
  * This function is responsible for indexing the week based
  * on the date of the event.
*/
function getWeekIndex(time) {
  const date = new Date(time);
  const currentDate = new Date();
  const diff = Math.abs(currentDate - date);
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  switch (true) {
    case diffDays < 7: return 4;
    case diffDays < 14: return 3;
    case diffDays < 21: return 2;
    case diffDays < 28: return 1;
    default: return 0;
  }
}

function handler(bundles) {
  const data = {};

  for (const bundle of bundles) {
    const weekIndex = getWeekIndex(bundle.time);
    const weekKey = `week${weekIndex}`;

    if (!data[bundle.url]) {
      data[bundle.url] = {};
    }

    if (!data[bundle.url][weekKey]) {
      data[bundle.url][weekKey] = {
        'pageViews': 0,
        'clicks': 0,
        'pageCTR': 0,
        'metrics': [] // Initialize metrics array
      };
    }

    data[bundle.url][weekKey].pageViews += bundle.weight;
    const selector = {};
    let selectors = {};
    for (const event of bundle.events) {
      if (event.checkpoint === 'click') {
        selector[event.source] = selector[event.source] ? selector[event.source] + 1 : 1;
      }
    }
    data[bundle.url][weekKey].clicks += Object.keys(selector).length * bundle.weight;
    data[bundle.url][weekKey].pageCTR = (data[bundle.url][weekKey].clicks / data[bundle.url][weekKey].pageViews) * 100;

    // Calculate CTR for each unique selector and add to metrics array
    for (const [source] of Object.entries(selector)) {
      const ctr = (1 / data[bundle.url][weekKey].pageViews) * 100;
      // data[bundle.url][weekKey].metrics.push({ selector: source, ctr });
      // If the selector already exists in the object, add the new CTR to the existing one
      if (selectors[source]) {
        selectors[source] += ctr;
      } else {
        // If the selector does not exist in the object, add it
        selectors[source] = ctr;
      }
    }
  }

  // remove pages with less than 5000 page views per day on average for the last 28 days
  for (const url in data) {
    const totalPageViews = Object.values(data[url]).reduce((acc, cur) => acc + cur.pageViews, 0);
    if (totalPageViews < PAGEVIEW_THRESHOLD) {
      delete data[url];
    }
  }

  console.log('data:', data);
  return data;
}

export default {
  handler,
};
/* c8 ignore end */
