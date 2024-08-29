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

/**
 * Calculates the total page views by URL from an array of bundles.
 * @param {Array<Object>} bundles - An array of RUM bundles (NOT Flat bundles).
 * @returns {Object} An object where keys are URLs and values are the total page views for each URL.
 */
function pageviewsByUrl(bundles) {
  return bundles.reduce((acc, cur) => {
    if (!acc[cur.url]) acc[cur.url] = 0;
    acc[cur.url] += cur.weight;
    return acc;
  }, {});
}

/**
 * Calculates the Click-Through Rate (CTR) by URL.
 * CTR is defined as the total number of sessions with at least one click event
 * divided by the total number of pageviews for each URL.
 *
 * @param {Array<Object>} bundles - An array of RUM bundles (NOT Flat bundles).
 * @returns {Object} - An object where the key is the URL and the value is the CTR value.
 */
function getCTRByUrl(bundles) {
  const aggregated = bundles.reduce((acc, bundle) => {
    const { url } = bundle;
    if (!acc[url]) {
      acc[url] = { sessionsWithClick: 0, totalPageviews: 0 };
    }
    const hasClick = bundle.events.some((event) => event.checkpoint === 'click');

    acc[url].totalPageviews += bundle.weight;
    if (hasClick) {
      acc[url].sessionsWithClick += bundle.weight;
    }
    return acc;
  }, {});
  return Object.entries(aggregated)
    .reduce((acc, [url, { sessionsWithClick, totalPageviews }]) => {
      acc[url] = (sessionsWithClick / totalPageviews);
      return acc;
    }, {});
}

/**
 * Calculates the Click-Through Rate (CTR) average for the entire site.
 * CTR is defined as the total number of sessions with at least one click event
 * divided by the total number of pageviews for each URL.
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
  getCTRByUrl,
  pageviewsByUrl,
};
