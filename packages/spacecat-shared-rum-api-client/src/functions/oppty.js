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

// scan through bundles for start and end date
// group by url
// filter for click events
// the weight wil equate to clicks

function collectOpptyPages(groupByUrl) {
  const { url, items: itemsByUrl } = groupByUrl;
  const today = new Date();
  const last28Days = new Date(today);
  last28Days.setDate(last28Days.getDate() - 100);

  const filteredItems = itemsByUrl.filter((item) => {
    const itemDate = new Date(item.time);
    return itemDate >= last28Days && itemDate <= today;
  });

  // aggregate total number of views per filtered item
  const views = filteredItems.reduce((acc, cur) => acc + cur.weight, 0);

  return {
    url,
    views,
  };
}

function handler(bundles) {
  const res = FlatBundle.fromArray(bundles)
    .filter((row) => row.checkpoint === 'click')
    .groupBy('url')
    .map(collectOpptyPages)
    .sort((a, b) => b.views - a.views); // sort desc by pageviews
  // eslint-disable-next-line no-console
  console.log('oppty', res);
  return res;
}

export default {
  handler,
  checkpoints: ['click'],
};
