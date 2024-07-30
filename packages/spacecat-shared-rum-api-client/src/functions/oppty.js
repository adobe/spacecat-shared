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
  console.log('itemsByUrl', itemsByUrl);
  console.log('url', url);

  const views = itemsByUrl.flatMap((item) => item.items).reduce((acc, cur) => acc + cur.weight, 0);
  console.log('views', views);
}

function handler(bundles) {
  const res = FlatBundle.fromArray(bundles)
    .filter((row) => row.checkpoint === 'click')
    .groupBy('url')
    .map(collectOpptyPages)
    .sort((a, b) => b.pageviews - a.pageviews); // sort desc by pageviews
  console.log('res', res);
  return res;
}

export default {
  handler,
  checkpoints: ['click'],
};
