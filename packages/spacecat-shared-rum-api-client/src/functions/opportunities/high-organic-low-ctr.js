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
import { getCTRByUrlAndChannel, getSiteAvgCTR } from '../../common/aggregateFns.js';

const DAILY_EARNED_THRESHOLD = 5000;
const CTR_THRESHOLD_RATIO = 0.95;
const DAILY_PAGEVIEW_THRESHOLD = 1000;
const CHANNELS_TO_CONSIDER = 5;

function convertToOpportunity(traffic) {
  const {
    url, total, ctr, paid, owned, earned, channels, siteAvgCTR, ctrByUrlAndChannel,
  } = traffic;

  const topChannels = Object.entries(channels)
    .sort((a, b) => b[1].total - a[1].total).slice(0, CHANNELS_TO_CONSIDER);
  const opportunity = {
    type: 'high-organic-low-ctr',
    page: url,
    screenshot: '',
    trackedPageKPIName: 'Click Through Rate',
    trackedPageKPIValue: ctr,
    pageViews: total,
    samples: total, // todo: get the actual number of samples
    siteAverage: siteAvgCTR,
    metrics: [{
      type: 'traffic',
      referrer: '*',
      value: {
        total,
        paid,
        owned,
        earned,
      },
    }, {
      type: 'ctr',
      referrer: '*',
      value: {
        page: ctr,
      },
    }],
  };
  opportunity.metrics.push(...topChannels.map(([channel, {
    total: _total, owned: _owned, earned: _earned, paid: _paid,
  }]) => {
    const trafficMetrics = {
      type: 'traffic',
      referrer: channel,
      value: {
        total: _total,
        owned: _owned,
        earned: _earned,
        paid: _paid,
      },
    };
    const ctrMetrics = {
      type: 'ctr',
      referrer: channel,
      value: {
        page: ctrByUrlAndChannel[channel],
      },
    };
    return [trafficMetrics, ctrMetrics];
  }));
  return opportunity;
}

function hasHighOrganicTraffic(interval, traffic) {
  const { earned, owned } = traffic;
  return earned + owned > DAILY_EARNED_THRESHOLD * interval;
}

function hasLowerCTR(ctr, siteAvgCTR) {
  return ctr < CTR_THRESHOLD_RATIO * siteAvgCTR;
}

function handler(bundles, opts = {}) {
  const { interval = 7 } = opts;

  const trafficByUrl = trafficAcquisition.handler(bundles);
  const ctrByUrlAndChannel = getCTRByUrlAndChannel(bundles);
  const siteAvgCTR = getSiteAvgCTR(bundles);

  return trafficByUrl.filter((traffic) => traffic.total > interval * DAILY_PAGEVIEW_THRESHOLD)
    .filter(hasHighOrganicTraffic.bind(null, interval))
    .filter((traffic) => hasLowerCTR(ctrByUrlAndChannel[traffic.url].value, siteAvgCTR))
    .map((traffic) => ({
      ...traffic,
      ctr: ctrByUrlAndChannel[traffic.url].value,
      siteAvgCTR,
      ctrByUrlAndChannel: ctrByUrlAndChannel[traffic.url].channels,
    }))
    .map(convertToOpportunity);
}

export default {
  handler,
  checkpoints: ['email', 'enter', 'paid', 'utm', 'click', 'experiment'],
};
