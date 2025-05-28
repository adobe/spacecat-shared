/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { getCTRByUrlAndVendor, getSiteAvgCTR, getCategoryCtrByUrl } from '../../common/aggregateFns.js';
import { classifyPageWithLLM } from './classifier.js';

const DAILY_EARNED_THRESHOLD = 100;
const CTR_THRESHOLD_RATIO = 0.95;
const DAILY_PAGEVIEW_THRESHOLD = 1000;
const VENDORS_TO_CONSIDER = 5;

const MAIN_TYPES = ['paid', 'earned', 'owned'];

function convertToOpportunity(traffic) {
  const {
    url,
    total, ctr, paid, owned, earned, sources,
    siteAvgCTR, ctrByUrlAndVendor, pageOnTime, categoryCtrByUrl,
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
    type: 'high-organic-low-ctr-v2',
    page: url,
    screenshot: '',
    pageClassification: classifyPageWithLLM(url),
    categoryCtr: categoryCtrByUrl[url]?.categoryCtr,
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

function getUrlClassificationAndCtr(urls, ctrByUrlAndVendor) {
  return urls.reduce((acc, url) => {
    const classification = classifyPageWithLLM(url);
    console.log(`classification of url [${url}] is [${classification}]`);
    const ctr = ctrByUrlAndVendor[url].value;
    acc[url] = { classification, ctr };
    return acc;
  }, {});
}

function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;

  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrlAndVendor = getCTRByUrlAndVendor(bundles);
  const classificationAndCtrByUrl = getUrlClassificationAndCtr(
    Object.keys(ctrByUrlAndVendor),
    ctrByUrlAndVendor,
  );
  console.log('classificationAndCtrByUrl', JSON.stringify(classificationAndCtrByUrl, null, 2));
  const categoryCtrByUrl = getCategoryCtrByUrl(bundles, classificationAndCtrByUrl);
  console.log('categoryCtrByUrl', JSON.stringify(categoryCtrByUrl, null, 2));
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl.filter((traffic) => traffic.total > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter(hasHighOrganicTraffic.bind(null, interval))
    .filter((traffic) => hasLowerCTR(
      categoryCtrByUrl[traffic.url]?.pageCtr,
      categoryCtrByUrl[traffic.url]?.categoryCtr,
    )).map((traffic) => ({
      ...traffic,
      ctr: ctrByUrlAndVendor[traffic.url].value,
      siteAvgCTR,
      ctrByUrlAndVendor: ctrByUrlAndVendor[traffic.url].vendors,
      categoryCtrByUrl,
      pageOnTime: traffic.maxTimeDelta,
    }))
    .map(convertToOpportunity);
}

export default {
  handler,
};
