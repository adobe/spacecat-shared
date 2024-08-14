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

import { FlatBundle } from '../common/flat-bundle.js';

/* c8 ignore start */
function collectOpptyPages(groupedByUrl) {
  const { items } = groupedByUrl;
  // eslint-disable-next-line no-console
  // console.log('items', items);

  // create a daily stats object
  // days array filtered by time on items
  // on the daily array read bundles and
  // 5k filtering by url on rumAPIClient (first clear by this)

  const PAGEVIEW_THRESHOLD = 5000;
  const DAILY_STATS = {};

  // filter the bundle by day using the time field and put it in the DAILY_STATS object
  items.forEach((item) => {
    const itemTime = new Date(item.time);
    const itemDate = itemTime.toISOString().split('T')[0];
    DAILY_STATS[itemDate] = DAILY_STATS[itemDate] || [];
    DAILY_STATS[itemDate].push(item);
  });

  const pageviews = items.reduce((acc, item) => acc + item.weight, 0);
  // eslint-disable-next-line no-console
  // console.log('pageviews', pageviews);

  const last28days = items.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 28);
    return itemTime > today > PAGEVIEW_THRESHOLD;
  });
  // eslint-disable-next-line no-console
  // console.log('last28days', last28days.length);

  const week1 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 21);
    return itemTime > today;
  });
  // calculate the CTR for week1
  const week1Pageviews = week1.reduce((acc, item) => acc + item.weight, 0);
  const week1Clicks = week1.filter((item) => item.checkpoint === 'click').length;
  const week1CTR = week1Clicks / week1Pageviews;

  const week2 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 14);
    return itemTime > today;
  });
  // calculate the CTR for week2
  const week2Pageviews = week2.reduce((acc, item) => acc + item.weight, 0);
  const week2Clicks = week2.filter((item) => item.checkpoint === 'click').length;
  const week2CTR = week2Clicks / week2Pageviews;

  const week3 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return itemTime > today;
  });
  // calculate the CTR for week3
  const week3Pageviews = week3.reduce((acc, item) => acc + item.weight, 0);
  const week3Clicks = week3.filter((item) => item.checkpoint === 'click').length;
  const week3CTR = week3Clicks / week3Pageviews;

  const week4 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate());
    return itemTime > today;
  });
  // calculate the CTR for week4
  const week4Pageviews = week4.reduce((acc, item) => acc + item.weight, 0);
  const week4Clicks = week4.filter((item) => item.checkpoint === 'click').length;
  const week4CTR = week4Clicks / week4Pageviews;

  return {
    type: 'CTR-decline-opportunity',
    opportunities: [
      {
        url: groupedByUrl.url,
        views: pageviews,
        description: 'CTR decline opportunity',
        metrics: [
          {
            type: 'click',
            week1: week1CTR,
            value: week1Clicks,
          },
          {
            type: 'click',
            week2: week2CTR,
            value: week2Clicks,
          },
          {
            type: 'click',
            week3: week3CTR,
            value: week3Clicks,
          },
          {
            type: 'click',
            week4: week4CTR,
            value: week4Clicks,
          },
        ],
      },
    ],
  };
}

function handler(bundles) {
  return FlatBundle.fromArray(bundles)
    .filter((row) => row.checkpoint === 'click' && row.weight === 100)
    .groupBy('url')
    .map(collectOpptyPages)
    .sort((a, b) => b.views - a.views); // sort desc by pageviews
}

export default {
  handler,
  checkpoints: ['click'],
};
/* c8 ignore end */
