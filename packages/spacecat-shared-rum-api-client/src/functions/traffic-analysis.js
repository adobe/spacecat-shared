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

import { classifyTraffic } from '../common/traffic.js';

function getTrafficType(bundle, memo) {
  const key = `${bundle.id}${bundle.url}${bundle.time}`;
  if (memo[key]) return memo[key];

  const type = classifyTraffic(bundle);
  // eslint-disable-next-line no-param-reassign
  memo[key] = type;
  return type;
}

const checkpoints = {
  /* eslint-disable no-param-reassign */
  utm: (result, source, target) => {
    if (source === 'utm_source') result.utmSource = target;
    else if (source === 'utm_medium') result.utmMedium = target;
    else if (source === 'utm_campaign') result.utmCampaign = target;
  },
  consent: (result, target) => {
    result.consent = target;
  },
  404: (result, source) => {
    result.notFoundSource = source;
  },
  click: (result) => {
    result.hasClick = true;
  },
  enter: (result) => {
    result.hasEntry = true;
  },
  viewmedia: (result, timeDelta) => {
    if (timeDelta >= 10000) {
      result.hasScroll = true;
    }
  },
  viewblock: (result, timeDelta) => {
    if (timeDelta >= 10000) {
      result.hasScroll = true;
    }
  },
  'cwv-lcp': (result, value) => {
    if (value > (result.lcp || 0)) result.lcp = value;
  },
  'cwv-cls': (result, value) => {
    if (value > (result.cls || 0)) result.cls = value;
  },
  'cwv-inp': (result, value) => {
    if (value > (result.inp || 0)) result.inp = value;
  },
  /* eslint-enable no-param-reassign */
};

function extractEventData(bundle) {
  const result = {
    utmSource: undefined,
    utmMedium: undefined,
    utmCampaign: undefined,
    consent: undefined,
    notFoundSource: undefined,
    hasClick: false,
    hasScroll: false,
    hasEntry: false,
    lcp: undefined,
    cls: undefined,
    inp: undefined,
  };

  for (const {
    checkpoint, source, target, timeDelta, value,
  } of bundle.events) {
    if (checkpoints[checkpoint]) {
      checkpoints[checkpoint](result, source, target, timeDelta, value);
    }
  }

  return result;
}

async function handler(bundles) {
  const memo = {};

  const result = bundles.map((bundle) => {
    const trafficType = getTrafficType(bundle, memo);
    const eventData = extractEventData(bundle);
    const hasEngagedClick = eventData.hasClick && eventData.consent !== 'show';

    return {
      path: new URL(bundle.url).pathname,
      type: trafficType.type,
      channel: trafficType.category,
      platform: trafficType.vendor,
      device: bundle.userAgent.split(':')[0],
      source: eventData.utmSource,
      medium: eventData.utmMedium,
      campaign: eventData.utmCampaign,
      referrer: bundle.referrer,
      consent: eventData.consent,
      notfound: eventData.notFoundSource,
      pageviews: bundle.weight,
      clicked: hasEngagedClick ? 1 : 0,
      entry: eventData.hasEntry ? 1 : 0,
      engaged: (hasEngagedClick || eventData.hasScroll) ? 1 : 0,
      lcp: eventData.lcp,
      cls: eventData.cls,
      inp: eventData.inp,
    };
  });

  return result;
}

export default {
  handler,
};
