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

import {
  extractTrafficHints, classifyVendor, getSecondLevelDomain, classifyTrafficSource,
} from './traffic.js';

/**
 * Calculates the Click-Through Rate (CTR) by URL and Referrer.
 * CTR is defined as the total number of sessions with at least one click event per referrer.
 * divided by the total number of pageviews for each URL per referrer.
 *
 * @param {Array<Object>} bundles - An array of RUM bundles (NOT Flat bundles).
 * @returns {Object} - An object where the key is the URL and the value is an object
 * with the CTR value by referrer.
 */
function getCTRByUrlAndVendor(bundles) {
  const aggregated = bundles.reduce((acc, bundle) => {
    const { url } = bundle;
    const trafficHints = extractTrafficHints(bundle);
    const referrerDomain = getSecondLevelDomain(trafficHints.referrer);
    const vendor = classifyVendor(referrerDomain, trafficHints.utmSource, trafficHints.utmMedium);
    if (!acc[url]) {
      acc[url] = { sessionsWithClick: 0, totalPageviews: 0, vendors: {} };
    }
    const hasClick = bundle.events.some((event) => event.checkpoint === 'click');

    acc[url].totalPageviews += bundle.weight;
    if (hasClick) {
      acc[url].sessionsWithClick += bundle.weight;
    }
    if (vendor) {
      if (!acc[url].vendors[vendor]) {
        acc[url].vendors[vendor] = { sessionsWithClick: 0, totalPageviews: 0 };
      }
      acc[url].vendors[vendor].totalPageviews += bundle.weight;
      if (hasClick) {
        acc[url].vendors[vendor].sessionsWithClick += bundle.weight;
      }
    }
    return acc;
  }, {});
  return Object.entries(aggregated)
    .reduce((acc, [url, { sessionsWithClick, totalPageviews, vendors }]) => {
      if (!acc[url]) {
        acc[url] = { value: 0, vendors: {} };
      }
      acc[url].value = (sessionsWithClick / totalPageviews);
      acc[url].vendors = Object.entries(vendors)
        .reduce((_acc, [source, {
          sessionsWithClick: _sessionsWithClick, totalPageviews: _totalPageviews,
        }]) => {
          // eslint-disable-next-line no-param-reassign
          _acc[source] = (_sessionsWithClick / _totalPageviews);
          return _acc;
        }, {});
      return acc;
    }, {});
}

function getCTRByUrlAndType(bundles) {
  const aggregated = bundles.reduce((acc, bundle) => {
    const { url } = bundle;
    const trafficHints = extractTrafficHints(bundle);
    const { type } = classifyTrafficSource(
      url,
      trafficHints.referrer,
      trafficHints.utmSource,
      trafficHints.utmMedium,
      trafficHints.trackingParams,
    );
    if (!acc[url]) {
      acc[url] = { sessionsWithClick: 0, totalPageviews: 0, types: {} };
    }
    const hasClick = bundle.events.some((event) => event.checkpoint === 'click');

    acc[url].totalPageviews += bundle.weight;
    if (hasClick) {
      acc[url].sessionsWithClick += bundle.weight;
    }
    if (type) {
      if (!acc[url].types[type]) {
        acc[url].types[type] = { sessionsWithClick: 0, totalPageviews: 0 };
      }
      acc[url].types[type].totalPageviews += bundle.weight;
      if (hasClick) {
        acc[url].types[type].sessionsWithClick += bundle.weight;
      }
    }
    return acc;
  }, {});
  return Object.entries(aggregated)
    .reduce((acc, [url, { sessionsWithClick, totalPageviews, types }]) => {
      if (!acc[url]) {
        acc[url] = { value: 0, types: {} };
      }
      acc[url].value = (sessionsWithClick / totalPageviews);
      acc[url].types = Object.entries(types)
        .reduce((_acc, [type, {
          sessionsWithClick: _sessionsWithClick, totalPageviews: _totalPageviews,
        }]) => {
          // eslint-disable-next-line no-param-reassign
          _acc[type] = (_sessionsWithClick / _totalPageviews).toFixed(2);
          return _acc;
        }, {});
      return acc;
    }, {});
}

/**
 * Calculates the Click-Through Rate (CTR) average for the entire site.
 * CTR is defined as the total number of sessions with at least one click event
 * divided by the total number of pageviews for the entire site.
 *
 * @param {Array<Object>} bundles - An array of RUM bundles (NOT Flat bundles).
 * @returns {number} - Average CTR for the site.
 */
function getSiteAvgCTR(bundles) {
  const aggregated = bundles.reduce((acc, bundle) => {
    const hasClick = bundle.events.some((event) => event.checkpoint === 'click');
    acc.totalPageviews += bundle.weight;
    if (hasClick) {
      acc.sessionsWithClick += bundle.weight;
    }
    return acc;
  }, { sessionsWithClick: 0, totalPageviews: 0 });

  return aggregated.totalPageviews === 0
    ? 0
    : aggregated.sessionsWithClick / aggregated.totalPageviews;
}

export {
  getSiteAvgCTR,
  getCTRByUrlAndVendor,
  getCTRByUrlAndType,
};
