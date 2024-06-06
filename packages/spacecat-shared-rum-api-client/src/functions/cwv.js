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

import { quantile } from 'd3-array';
import { pageviewsByUrl } from '../common/aggregateFns.js';
import { FlatBundle } from '../common/flat-bundle.js';

const CWV_METRICS = ['lcp', 'cls', 'inp', 'ttfb'].map((metric) => `cwv-${metric}`);

function collectCWVs(groupedByUrlIdTime) {
  const { url, items: itemsByUrl } = groupedByUrlIdTime;

  // first level: grouped by url
  const CWVs = itemsByUrl.reduce((acc, { items: itemsById }) => {
    // second level: grouped by id
    const maximums = itemsById.flatMap((itemById) => itemById.items)
      // third level: grouped by time
      .reduce((values, item) => {
        // each session (id-time) can contain multiple measurement for the same metric
        // we need to find the maximum per metric type
        // eslint-disable-next-line no-param-reassign
        values[item.checkpoint] = Math.max(values[item.checkpoint] || 0, item.value);
        return values;
      }, {});

    // max values per id for each metric type are collected into an array
    CWV_METRICS.forEach((metric) => {
      if (!acc[metric]) acc[metric] = [];
      if (maximums[metric]) {
        acc[metric].push(maximums[metric]);
      }
    });
    return acc;
  }, {});

  return {
    url,
    lcp: quantile(CWVs['cwv-lcp'], 0.75) || null,
    lcpCount: CWVs['cwv-lcp'].length,
    cls: quantile(CWVs['cwv-cls'], 0.75) || null,
    clsCount: CWVs['cwv-cls'].length,
    inp: quantile(CWVs['cwv-inp'], 0.75) || null,
    inpCount: CWVs['cwv-inp'].length,
    ttfb: quantile(CWVs['cwv-ttfb'], 0.75) || null,
    ttfbCount: CWVs['cwv-ttfb'].length,
  };
}

function handler(bundles) {
  const pageviews = pageviewsByUrl(bundles);

  return FlatBundle.fromArray(bundles)
    .groupBy('url', 'id', 'time')
    .map(collectCWVs)
    .filter((row) => row.lcp || row.cls || row.inp || row.ttfb) // filter out pages with no cwv data
    .map((acc) => {
      acc.pageviews = pageviews[acc.url];
      return acc;
    })
    .sort((a, b) => b.pageviews - a.pageviews); // sort desc by pageviews
}

export default {
  handler,
  checkpoints: ['cwv-lcp', 'cwv-cls', 'cwv-inp', 'cwv-ttfb'],
};
