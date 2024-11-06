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

/* c8 ignore start */
const PAGEVIEW_THRESHOLD = 35000;

function getWeekIndex(time) {
  const date = new Date(time);
  const currentDate = new Date();
  const diff = Math.abs(currentDate - date);
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  switch (true) {
    case diffDays < 7: return 4;
    case diffDays < 14: return 3;
    case diffDays < 21: return 2;
    case diffDays < 28: return 1;
    default: return 0;
  }
}

function processBundles(bundles) {
  const data = {};

  for (const bundle of bundles) {
    const weekIndex = getWeekIndex(bundle.time);
    const weekKey = `week${weekIndex}`;

    if (!data[bundle.url]) {
      data[bundle.url] = {};
    }

    if (!data[bundle.url][weekKey]) {
      data[bundle.url][weekKey] = {
        pageViews: 0,
        clicks: 0,
        pageCTR: 0,
        metrics: [],
      };
    }

    data[bundle.url][weekKey].pageViews += bundle.weight;
    const selector = {};
    const bundleWeight = bundle.weight;
    for (const event of bundle.events) {
      if (event.checkpoint === 'click') {
        selector[event.source] = selector[event.source] ? selector[event.source] + 1 : 1;
      }
    }

    for (const source of Object.keys(selector)) {
      // eslint-disable-next-line max-len
      const existingMetric = data[bundle.url][weekKey].metrics.find((metric) => metric.selector === source);
      if (existingMetric) {
        existingMetric.clicks += bundleWeight;
      } else {
        data[bundle.url][weekKey].metrics.push({ selector: source, clicks: bundleWeight });
      }
    }

    data[bundle.url][weekKey].clicks += Object.keys(selector).length > 0 ? bundleWeight : 0;
  }

  // eslint-disable-next-line guard-for-in,no-restricted-syntax
  for (const url in data) {
    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const weekKey in data[url]) {
      // eslint-disable-next-line max-len
      data[url][weekKey].pageCTR = parseFloat((data[url][weekKey].clicks / data[url][weekKey].pageViews).toFixed(2));
      data[url][weekKey].metrics = data[url][weekKey].metrics.map((metric) => {
        // eslint-disable-next-line no-param-reassign
        metric.ctr = parseFloat((metric.clicks / data[url][weekKey].pageViews).toFixed(2));
        return metric;
      }).filter((metric) => metric.ctr >= 0.05);
    }
  }

  // eslint-disable-next-line guard-for-in,no-restricted-syntax
  for (const url in data) {
    let hasEnoughPageViews = true;
    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const weekKey in data[url]) {
      if (data[url][weekKey].pageViews < PAGEVIEW_THRESHOLD) {
        hasEnoughPageViews = false;
        break;
      }
    }
    if (!hasEnoughPageViews) {
      delete data[url];
    }
  }

  return data;
}

function handler(bundles) {
  const acquisitionBundles = [];
  const nonAcquisitionBundles = [];

  for (const bundle of bundles) {
    const hasAcquisition = bundle.events.some((event) => event.checkpoint === 'acquisition');
    if (hasAcquisition) {
      acquisitionBundles.push(bundle);
    } else {
      nonAcquisitionBundles.push(bundle);
    }
  }

  const acquisitionData = processBundles(acquisitionBundles);
  const nonAcquisitionData = processBundles(nonAcquisitionBundles);

  return {
    acquisitionData,
    nonAcquisitionData,
  };
}

export default {
  handler,
};

// eslint-disable-next-line guard-for-in,no-restricted-syntax
/* c8 ignore end */
