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
    for (const event of bundle.events) {
      if (event.checkpoint === 'click') {
        selector[event.source] = selector[event.source] ? selector[event.source] + 1 : 1;
      }
    }
    data[bundle.url][weekKey].clicks += Object.keys(selector).length * bundle.weight;
    data[bundle.url][weekKey].pageCTR = (data[bundle.url][weekKey].clicks / data[bundle.url][weekKey].pageViews) * 100;

    // Calculate CTR for each unique selector and add to metrics array
  //   for (const [source] of Object.entries(selector)) {
  //     const ctr = (1 / data[bundle.url][weekKey].pageViews) * 100;
  //     data[bundle.url][weekKey].metrics.push({ selector: source, ctr });
  // }
    // Initialize an object to hold the selectors and their counts
    let globalSelectors = {};

    for (const bundle of bundles) {
      // Initialize a Set to hold the unique selectors for this bundle
      let uniqueSelectors = new Set();

      for (const event of bundle.events) {
        if (event.checkpoint === 'click') {
          uniqueSelectors.add(event.source);
        }
      }

      // Iterate over the unique selectors and increment their count in the global selectors object
      for (const source of uniqueSelectors) {
        globalSelectors[source] = (globalSelectors[source] || 0) + 1;
      }
    }

// Now, globalSelectors contains the count of each selector across all bundles
// Convert the globalSelectors object to an array of objects and add it to the metrics array
    // data[bundle.url][weekKey].metrics = Object.entries(globalSelectors).map(([selector, count]) => ({ selector, count }));
    data[bundle.url][weekKey].metrics = Object.entries(globalSelectors).map(([selector, count]) => {
      const ctr = (count / data[bundle.url][weekKey].pageViews) * 100;
      return { selector, ctr };
    });
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
