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

import { utils } from '@adobe/rum-distiller';
import { classifyTraffic } from '../common/traffic.js';

function getUTM(bundle, type) {
  return bundle.events
    .find((e) => e.checkpoint === 'utm' && e.source === `utm_${type}`)
    ?.target || null;
}

function getCWV(bundle, metric) {
  const measurements = bundle.events
    .filter((e) => e.checkpoint === `cwv-${metric}`)
    .map((e) => e.value);

  return measurements.length > 0 ? Math.max(...measurements) : null;
}

function containsEngagedScroll(bundle) {
  return bundle.events
    .some((e) => (e.checkpoint === 'viewmedia' || e.checkpoint === 'viewblock') && e.timeDelta >= 10000)
    ? 1 : 0;
}

function getNotFound(bundle) {
  return bundle.events
    .find((e) => e.checkpoint === '404')
    ?.source || null;
}

function getReferrer(bundle) {
  const enterCheckpoint = bundle.events
    .find((e) => e.checkpoint === 'enter')
    ?.source;

  const navigateCheckpoint = bundle.events
    .find((e) => e.checkpoint === 'navigate')
    ?.source;

  return navigateCheckpoint || enterCheckpoint || null;
}

function getClicked(bundle) {
  const latestClickEvent = bundle.events
    .filter((e) => e.checkpoint === 'click')
    .reduce((latest, current) => {
      if (!latest || !latest.timeDelta) return current;
      if (current?.timeDelta > latest.timeDelta) return current;
      return latest;
    }, null);

  if (!latestClickEvent) return 0;

  const isConsentClick = !!utils.reclassifyConsent(latestClickEvent).vendor;

  if (isConsentClick) return 0;

  return 1;
}

function getConsent(bundle) {
  const consentBannerStatus = bundle.events
    .find((e) => e.checkpoint === 'consent')
    ?.target;

  const consentClick = bundle.events.find((e) => e.checkpoint === 'click' && utils.reclassifyConsent(e).vendor);

  if (!consentClick) return consentBannerStatus || null;

  return utils.reclassifyConsent(consentClick).target;
}

function trafficType(bundle, memo) {
  const key = `${bundle.id}${bundle.url}${bundle.time}`;
  if (memo[key]) return memo[key];

  const type = classifyTraffic(bundle);
  // eslint-disable-next-line no-param-reassign
  memo[key] = type;
  return type;
}

async function handler(bundles) {
  const memo = {};

  const result = bundles.map((bundle) => {
    /* eslint-disable camelcase */
    const trafficData = trafficType(bundle, memo);
    const clicked = getClicked(bundle);

    return {
      path: new URL(bundle.url).pathname,
      trf_type: trafficData.type,
      trf_channel: trafficData.category,
      trf_platform: trafficData.vendor || null,
      device: bundle.userAgent.split(':')[0],
      utm_source: getUTM(bundle, 'source'),
      utm_medium: getUTM(bundle, 'medium'),
      utm_campaign: getUTM(bundle, 'campaign'),
      referrer: getReferrer(bundle),
      consent: getConsent(bundle),
      notfound: getNotFound(bundle),
      pageviews: bundle.weight,
      clicked,
      engaged: containsEngagedScroll(bundle) || clicked,
      lcp: getCWV(bundle, 'lcp'),
      inp: getCWV(bundle, 'inp'),
      cls: getCWV(bundle, 'cls'),
    };
    /* eslint-enable camelcase */
  });

  return result;
}

export default {
  handler,
};
