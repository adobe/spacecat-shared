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

const VENDORS_TO_CONSIDER = 5;
const MAX_OPPORTUNITIES = 100;

const MAIN_TYPES = ['paid', 'earned', 'owned'];

function convertToOpportunity(traffic) {
  const {
    url, total, ctr, paid, percentileScore, owned, earned,
    sources, siteAvgCTR, ctrByUrlAndVendor, pageOnTime,
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
    percentileScore,
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

/**
 * Sort pages by earned AND overall traffic using percentile scoring.
 * @param {Array} pages - List of { url, total, earned }
 * @returns {Array} List of pages sorted by joint strength
 */
function sortPagesByEarnedAndOverallTraffic(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return [];

  const sortedOverall = [...pages].sort((a, b) => a.total - b.total);
  const sortedEarned = [...pages].sort((a, b) => {
    if (a.earned === b.earned) {
      return a.total - b.total;
    }
    return a.earned - b.earned;
  });
  const n = pages.length;

  const percentiles = pages.map((p) => {
    const totalPercentile = sortedOverall.findIndex((x) => x.url === p.url) / (n - 1);
    const earnedPercentile = sortedEarned.findIndex((x) => x.url === p.url) / (n - 1);
    const percentileScore = totalPercentile * earnedPercentile;
    return { ...p, percentileScore };
  });

  return percentiles.sort((a, b) => b.percentileScore - a.percentileScore);
}

function handler(bundles) {
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrlAndVendor = getCTRByUrlAndVendor(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);
  const pagesSortedByEarnedAndOverallTraffic = sortPagesByEarnedAndOverallTraffic(
    trafficByUrl,
  ).slice(0, MAX_OPPORTUNITIES);

  return pagesSortedByEarnedAndOverallTraffic.map((traffic) => ({
    ...traffic,
    ctr: ctrByUrlAndVendor[traffic.url].value,
    siteAvgCTR,
    ctrByUrlAndVendor: ctrByUrlAndVendor[traffic.url].vendors,
    pageOnTime: traffic.maxTimeDelta,
  })).map(convertToOpportunity);
}

export default {
  handler,
};
