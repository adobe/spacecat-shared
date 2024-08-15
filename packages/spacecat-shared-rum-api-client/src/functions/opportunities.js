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

const PAGEVIEW_THRESHOLD = 5000;
const DAILY_STATS = {};
const METRIC_CHECKPOINTS = 'click';

function collectOpptyPages(groupedByUrl) {
  const { url, items } = groupedByUrl;
  // eslint-disable-next-line no-console
  // console.log('url:', url, 'items:', items);

  // filter the bundle by day using the time field and put it in the DAILY_STATS object
  items.forEach((item) => {
    const itemTime = new Date(item.time);
    const itemDate = itemTime.toISOString().split('T')[0];
    DAILY_STATS[itemDate] = DAILY_STATS[itemDate] || [];
    DAILY_STATS[itemDate].push(item);
  });

  const pageViews = items.reduce((acc, item) => acc + item.weight, 0);
  if (pageViews < PAGEVIEW_THRESHOLD) {
    return null;
  }

  const last28days = items.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 28);
    return itemTime > today;
  });
  // eslint-disable-next-line no-console
  // console.log('last28days:', last28days);

  const week1 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const today = new Date();
    today.setDate(today.getDate() - 21);
    return itemTime < today;
  });

  // let week1Pageviews = 0;
  // let week1Clicks = 0;
  // let week1CTR = 0;

  // calculate the CTR for week1
  const week1Pageviews = week1.reduce((acc, item) => {
    // eslint-disable-next-line no-console
    console.log('item in week 1:', item);
    return acc + item.weight;
  }, 0);
  // eslint-disable-next-line no-console
  console.log('week1Pageviews:', week1Pageviews);
  const week1Clicks = week1.filter((item) => item.checkpoint === METRIC_CHECKPOINTS).length;
  // eslint-disable-next-line no-console
  console.log('week1Clicks:', week1Clicks);
  const week1CTR = (week1Clicks / week1Pageviews) * 100;
  // eslint-disable-next-line no-console
  console.log('week1CTR:', week1CTR);

  const week2 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const startWeek2 = new Date();
    startWeek2.setDate(startWeek2.getDate() - 21);
    const endWeek2 = new Date();
    endWeek2.setDate(endWeek2.getDate() - 14);
    return itemTime > startWeek2 && itemTime <= endWeek2;
  });
  // calculate the CTR for week2
  const week2Pageviews = week2.reduce((acc, item) => acc + item.weight, 0);
  const week2Clicks = week2.filter((item) => item.checkpoint === METRIC_CHECKPOINTS).length;
  const week2CTR = (week2Clicks / week2Pageviews) * 100;

  const week3 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const startWeek3 = new Date();
    startWeek3.setDate(startWeek3.getDate() - 14);
    const endWeek3 = new Date();
    endWeek3.setDate(endWeek3.getDate() - 7);
    return itemTime > startWeek3 && itemTime <= endWeek3;
  });
  // calculate the CTR for week3
  const week3Pageviews = week3.reduce((acc, item) => acc + item.weight, 0);
  const week3Clicks = week3.filter((item) => item.checkpoint === 'click').length;
  const week3CTR = (week3Clicks / week3Pageviews) * 100;

  const week4 = last28days.filter((item) => {
    const itemTime = new Date(item.time);
    const startWeek4 = new Date();
    startWeek4.setDate(startWeek4.getDate() - 7);
    return itemTime > startWeek4;
  });
  // calculate the CTR for week4
  const week4Pageviews = week4.reduce((acc, item) => acc + item.weight, 0);
  const week4Clicks = week4.filter((item) => item.checkpoint === 'click').length;
  const week4CTR = (week4Clicks / week4Pageviews) * 100;

  return {
    type: 'CTR-decline-opportunity',
    opportunities: [
      {
        url,
        pageViews,
        description: 'The click-through-rate is declining. Consider improving the user experience.',
        metrics: [
          {
            type: METRIC_CHECKPOINTS,
            week1: week1CTR,
            value: week1Clicks,
          },
          {
            type: METRIC_CHECKPOINTS,
            week2: week2CTR,
            value: week2Clicks,
          },
          {
            type: METRIC_CHECKPOINTS,
            week3: week3CTR,
            value: week3Clicks,
          },
          {
            type: METRIC_CHECKPOINTS,
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
    .filter((row) => row.checkpoint === METRIC_CHECKPOINTS && row.weight === 100)
    .groupBy('url')
    .map(collectOpptyPages);
}

export default {
  handler,
  checkpoints: METRIC_CHECKPOINTS,
};
/* c8 ignore end */
