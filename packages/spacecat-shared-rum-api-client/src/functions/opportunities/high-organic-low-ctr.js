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

import trafficAcquisition from '../traffic-acquisition.js';
import { getCTRByUrlAndVendor, getSiteAvgCTR } from '../../common/aggregateFns.js';

const DAILY_EARNED_THRESHOLD = 1000;
const CTR_THRESHOLD_RATIO = 0.95;
const DAILY_PAGEVIEW_THRESHOLD = 1000;
const VENDORS_TO_CONSIDER = 5;

const MAIN_TYPES = ['paid', 'earned', 'owned'];

function convertToOpportunity(traffic) {
  const {
    url, total, ctr, paid, owned, earned, sources, siteAvgCTR, ctrByUrlAndVendor, pageOnTime,
  } = traffic;

  const vendors = sources.reduce((acc, { type, views }) => {
    const [trafficType, , vendor] = type.split(':');
    if (!vendor) {
      return acc;
    }
    if (MAIN_TYPES.includes(trafficType)) {
      acc[vendor] = acc[vendor] || {
        total: 0, owned: 0, earned: 0, paid: 0,
      };
      acc[vendor].total += views;
      acc[vendor][trafficType] += views;
    }
    return acc;
  }, {});

  const topVendors = Object.entries(vendors)
    .sort((a, b) => b[1].total - a[1].total).slice(0, VENDORS_TO_CONSIDER);
  const opportunity = {
    type: 'high-organic-low-ctr',
    page: url,
    screenshot: '',
    trackedPageKPIName: 'Click Through Rate',
    trackedPageKPIValue: ctr,
    trackedKPISiteAverage: siteAvgCTR,
    pageViews: total,
    samples: total, // todo: get the actual number of samples
    metrics: [{
      type: 'traffic',
      vendor: '*',
      value: {
        total,
        paid,
        owned,
        earned,
      },
    }, {
      type: 'ctr',
      vendor: '*',
      value: {
        page: ctr,
      },
    }, {
      type: 'pageOnTime',
      vendor: '*',
      value: {
        time: pageOnTime,
      },
    }],
  };
  opportunity.metrics.push(...topVendors.flatMap(([vendor, {
    total: _total, owned: _owned, earned: _earned, paid: _paid,
  }]) => {
    const trafficMetrics = {
      type: 'traffic',
      vendor,
      value: {
        total: _total,
        owned: _owned,
        earned: _earned,
        paid: _paid,
      },
    };
    const ctrMetrics = {
      type: 'ctr',
      vendor,
      value: {
        page: ctrByUrlAndVendor[vendor],
      },
    };
    const pageOnTimeMetrics = {
      type: 'pageOnTime',
      vendor,
      value: {
        time: pageOnTime,
      },
    };
    return [trafficMetrics, ctrMetrics, pageOnTimeMetrics];
  }));
  return opportunity;
}

function hasHighOrganicTraffic(interval, traffic) {
  const { earned } = traffic;
  return earned >= DAILY_EARNED_THRESHOLD * interval;
}

function hasLowerCTR(ctr, siteAvgCTR) {
  return ctr < CTR_THRESHOLD_RATIO * siteAvgCTR;
}

function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;

  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrlAndVendor = getCTRByUrlAndVendor(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl.filter((traffic) => traffic.total > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter(hasHighOrganicTraffic.bind(null, interval))
    .filter((traffic) => hasLowerCTR(ctrByUrlAndVendor[traffic.url].value, siteAvgCTR))
    .map((traffic) => ({
      ...traffic,
      ctr: ctrByUrlAndVendor[traffic.url].value,
      siteAvgCTR,
      ctrByUrlAndVendor: ctrByUrlAndVendor[traffic.url].vendors,
      pageOnTime: traffic.maxTimeDelta,
    }))
    .map(convertToOpportunity);
}

export default {
  handler,
};
