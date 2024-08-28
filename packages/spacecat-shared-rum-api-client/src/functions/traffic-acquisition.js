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

import { classifyTrafficSource } from '../common/traffic.js';

function extractHints(bundle) {
  const findEvent = (checkpoint, source = '') => bundle.events.find((e) => e.checkpoint === checkpoint && (!source || e.source === source)) || {};

  const referrer = findEvent('enter').source || '';
  const utmSource = findEvent('utm', 'utm_source').target || '';
  const utmMedium = findEvent('utm', 'utm_medium').target || '';
  const tracking = findEvent('paid').checkpoint || findEvent('email').checkpoint || '';

  return {
    url: bundle.url,
    weight: bundle.weight,
    referrer,
    utmSource,
    utmMedium,
    tracking,
  };
}

function collectByUrlAndTrafficSource(acc, { url, weight, trafficSource }) {
  acc[url] = acc[url] || { total: 0 };
  acc[url][trafficSource] = (acc[url][trafficSource] || 0) + weight;
  acc[url].total += weight;
  return acc;
}

function transformFormat(trafficSources) {
  return Object.entries(trafficSources).map(([url, value]) => ({
    url,
    total: value.total,
    sources: Object.entries(value)
      .filter(([source]) => source !== 'total')
      .map(([source, views]) => ({ type: source, views })),
  }));
}

async function handler(bundles) {
  const trafficSources = bundles
    .map(extractHints)
    .map((row) => {
      const {
        type,
        category,
      } = classifyTrafficSource(row.url, row.referrer, row.utmSource, row.utmMedium, row.tracking);
      return {
        url: row.url,
        weight: row.weight,
        trafficSource: `${type}:${category}`,
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
