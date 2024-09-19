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

import { classifyTrafficSource, extractTrafficHints } from '../common/traffic.js';

const MAIN_TYPES = ['total', 'paid', 'earned', 'owned'];

function collectByUrlAndTrafficSource(acc, {
  url, weight, trafficSource, vendor,
}) {
  acc[url] = acc[url] || {
    total: 0, owned: 0, earned: 0, paid: 0, vendors: {},
  };
  acc[url][trafficSource] = (acc[url][trafficSource] || 0) + weight;
  acc[url].total += weight;
  const trafficType = trafficSource.split(':')[0];
  acc[url][trafficType] += weight;
  if (vendor) {
    if (!acc[url].vendors[vendor]) {
      acc[url].vendors[vendor] = {
        total: 0, owned: 0, earned: 0, paid: 0,
      };
    }
    acc[url].vendors[vendor].total += weight;
    acc[url].vendors[vendor][trafficType] += weight;
  }
  return acc;
}

function transformFormat(trafficSources) {
  return Object.entries(trafficSources).map(([url, value]) => ({
    url,
    total: value.total,
    earned: value.earned,
    owned: value.owned,
    paid: value.paid,
    sources: Object.entries(value)
      .filter(([source]) => !MAIN_TYPES.includes(source) && source !== 'vendors')
      .map(([source, views]) => ({ type: source, views })),
    vendors: value.vendors,
  }));
}

function handler(bundles) {
  const trafficSources = bundles
    .map(extractTrafficHints)
    .map((row) => {
      const {
        type,
        category,
        vendor,
      } = classifyTrafficSource(row.url, row.referrer, row.utmSource, row.utmMedium, row.tracking);
      return {
        url: row.url,
        weight: row.weight,
        trafficSource: `${type}:${category}`,
        vendor,
      };
    })
    .reduce(collectByUrlAndTrafficSource, {});

  return transformFormat(trafficSources)
    .sort((a, b) => b.total - a.total); // sort desc by total views
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'experiment'],
};
