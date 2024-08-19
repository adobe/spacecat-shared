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
// const METRIC_CHECKPOINTS = 'click';
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
    const pageViews = bundles.reduce((acc, item) => acc + item.weight, 0);
    if (pageViews < PAGEVIEW_THRESHOLD) {
      return ;
    }
    const weekIndex = getWeekIndex(bundle.time);
    const weekKey = `week${weekIndex}`;

    if (!data[bundle.url]) {
      data[bundle.url] = {};
    }

    if (!data[bundle.url][weekKey]) {
      data[bundle.url][weekKey] = {
        'pageViews': pageViews,
        'clicks':0,
        'CTR': 0,
      };
    }
  }
  // for (const bundle of bundles) {
  //   const pageViews = bundles.reduce((acc, item) => acc + item.weight, 0);
  //   if (pageViews < PAGEVIEW_THRESHOLD) {
  //     return ;
  //   }
  //   const weekIndex = getWeekIndex(bundle.time);
  //   const weekKey = `week${weekIndex}`;
  //
  //   if (!data[bundle.url]) {
  //     data[bundle.url] = {
  //       'week1': {
  //         'pageViews': pageViews,
  //         'clicks':0,
  //         'CTR': 0,
  //       },
  //       'week2': {
  //         'pageViews': pageViews,
  //         'clicks': 0,
  //         'CTR': 0,
  //       },
  //       'week3': {
  //         'pageViews': pageViews,
  //         'clicks': 0,
  //         'CTR': 0,
  //       },
  //       'week4': {
  //         'pageViews': pageViews,
  //         'clicks': 0,
  //         'CTR': 0,
  //       },
  //     };
  //   }
  // }

  console.log('data:', data);
  return data;
  // const data = {
  //   url: {
  //     'week1': {
  //       'pageViews': 0,
  //       'clicks': 0,
  //       'CTR': 0,
  //     },
  //     'week2': {
  //       'pageViews': 0,
  //       'clicks': 0,
  //       'CTR': 0,
  //     },
  //     'week3': {
  //       'pageViews': 0,
  //       'clicks': 0,
  //       'CTR': 0,
  //     },
  //     'week4': {
  //       'pageViews': 0,
  //       'clicks': 0,
  //       'CTR': 0,
  //     },
  //   },
  // };
}

export default {
  handler,
  // checkpoints: METRIC_CHECKPOINTS,
};
/* c8 ignore end */
