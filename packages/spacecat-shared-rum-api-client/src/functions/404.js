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

function collect404s(groupedByUrlAndSource) {
  const { url, items: itemsByUrl } = groupedByUrlAndSource;

  // find top source which has the most amount of occurrences
  const { source: topSource } = itemsByUrl.reduce(
    (max, obj) => (obj.items.length > max.items.length ? obj : max),
  );

  // calculate the total number of views per 404 event
  const views = itemsByUrl.flatMap((item) => item.items).reduce((acc, cur) => acc + cur.weight, 0);
  return {
    url,
    views,
    all_sources: itemsByUrl.map((item) => item.source),
    source_count: itemsByUrl.length,
    top_source: topSource,
  };
}

function handler(bundles) {
  return FlatBundle.fromArray(bundles)
    .filter((row) => row.checkpoint === '404')
    .groupBy('url', 'source')
    .map(collect404s)
    .sort((a, b) => b.views - a.views); // sort desc by views
}

export default {
  handler,
  checkpoints: ['404'],
};
