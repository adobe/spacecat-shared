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
import { fetch } from '../utils.js';

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

/* c8 ignore start */
/*
 * throw-away code for a single customer who customized the experimentation engine
 * this code will be removed once they start using the default exp engine
 */
async function mergeBundlesWithSameId(bundles) {
  if (!bundles[0]?.url.includes('bamboohr.com')) return bundles;
  const manifestUrls = [
    ...new Set(bundles.flatMap((bundle) => bundle.events
      .filter((e) => e.checkpoint === 'experiment')
      .map((e) => e.source))),
  ].map((experiment) => fetch(`https://www.bamboohr.com/experiments/${experiment}/manifest.json`));

  const experiments = await Promise.all(manifestUrls);
  const variants = (await Promise.all(experiments.map((e) => e.json().catch(() => {}))))
    .filter((json) => json && Object.keys(json).length > 0)
    .flatMap((json) => json.experiences?.data ?? [])
    .filter((data) => data.Name === 'Pages');

  const mapping = variants.reduce((acc, cur) => {
    Object.entries(cur)
      .filter(([k]) => !['Name', 'Control'].includes(k))
      .forEach(([, v]) => {
        acc[new URL(v).pathname] = new URL(cur.Control).pathname;
      });
    return acc;
  }, {});

  const variantPaths = Object.keys(mapping);

  const getControlPath = (url) => {
    const path = new URL(url).pathname;
    if (variantPaths.includes(path)) return mapping[path];
    return path;
  };

  const byIdAndPath = bundles.reduce((acc, cur) => {
    const controlPath = getControlPath(cur.url);
    const key = `${cur.id}-${controlPath}`;
    if (!acc[key]) acc[key] = [];
    if (variantPaths.includes(new URL(cur.url).pathname)) {
      // eslint-disable-next-line no-param-reassign
      cur.url = new URL(controlPath, cur.url).href;
    }
    acc[key].push(cur);
    return acc;
  }, {});

  const merged = Object.entries(byIdAndPath).flatMap(([, v]) => {
    let value = v;
    if (v.length > 1) {
      v[0].events.push(...v.slice(1).flatMap((bundle) => bundle.events));
      value = [v[0]];
    }
    return value;
  });

  return Object.values(merged);
}
/* c8 ignore end */

async function handler(bundles) {
  const merged = await mergeBundlesWithSameId(bundles);
  const trafficSources = merged
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
