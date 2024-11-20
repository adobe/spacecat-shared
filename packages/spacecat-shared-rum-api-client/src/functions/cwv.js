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
    const itemsByTime = itemsById.flatMap((itemById) => itemById.items);
    // third level: grouped by time
    const maximums = itemsByTime.reduce((values, item) => {
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

function groupByWithPattern(data, groupedURLs, ...keys) {
  const result = [];

  // Helper function to find the matching pattern
  const findMatchingPattern = (url) => {
    const matchedGroup = groupedURLs.find(({ pattern }) => {
      try {
        const regex = new RegExp(pattern.replace(/\*/g, '.*')); // @TODO
        return regex.test(url);
      } catch (error) {
        console.error(`Invalid pattern: ${pattern}`, error);
        return false;
      }
    });
    return matchedGroup ? matchedGroup.pattern : null; // Return the pattern or null
  };

  // Iterate through each item in the data
  for (const item of data) {
    const pattern = findMatchingPattern(item.url);
    const topLevelKey = pattern || item.url; // Use pattern or the URL itself

    // Find or create the top-level group
    let group = result.find((g) => g.pattern === topLevelKey || g.url === topLevelKey);
    if (!group) {
      group = pattern
          ? { pattern: topLevelKey, items: [] }
          : { url: topLevelKey, items: [] }; // Separate grouping for non-matching URLs
      result.push(group);
    }

    // Process additional grouping keys (id, time, etc.)
    let currentLevel = group.items;
    for (const key of keys) {
      let subGroup = currentLevel.find((g) => g[key] === item[key]);
      if (!subGroup) {
        subGroup = { [key]: item[key], items: [] };
        currentLevel.push(subGroup);
      }
      currentLevel = subGroup.items;
    }

    // Add the item to the final group
    currentLevel.push(item);
  }

  return result;
}

function handler(bundles, groupedURLs) {
  const pageviews = pageviewsByUrl(bundles);

  let result;

  result = FlatBundle.fromArray(bundles);

  // Original method
  // result = result.groupBy('url', 'id', 'time');

  // POC method
  result = groupByWithPattern(result, groupedURLs, 'id', 'time');

  result.map(collectCWVs)
      .filter((row) => row.lcp || row.cls || row.inp || row.ttfb) // filter out pages with no cwv data
      .map((acc) => {
        acc.pageviews = pageviews[acc.url];
        return acc;
      })
      .sort((a, b) => b.pageviews - a.pageviews); // sort desc by pageviews

  return result;
}

export default {
  handler,
  checkpoints: ['cwv-lcp', 'cwv-cls', 'cwv-inp', 'cwv-ttfb'],
};
