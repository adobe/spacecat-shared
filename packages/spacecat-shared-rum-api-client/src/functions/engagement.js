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

const hasEngagement = (bundle) => {
  const clickEngagement = bundle.events.filter((evt) => evt.checkpoint === 'click').length > 0
    ? bundle.weight
    : 0;
  const contentEngagement = bundle.events
    .filter((evt) => evt.checkpoint === 'viewmedia' || evt.checkpoint === 'viewblock')
    .length > 3
    ? bundle.weight
    : 0;
  return clickEngagement || contentEngagement;
};

/**
 * Calculates engagement metrics for all pages from RUM data.
 * A page view is considered engaged if there has been at least some user interaction (click events)
 * or significant content has been viewed (4 or more viewmedia or viewblock events).
 * Ref. - https://github.com/adobe/rum-distiller/blob/22f8b3caa6d700f4d1cbe29a94b7da34b9d50764/series.js#L89
 *
 * @param {Array} bundles - The RUM bundles to calculate engagement metrics for.
 * @returns {Array} An array of engagement metrics for each page.
 */
function handler(bundles) {
  const urlsData = {};
  bundles.forEach((bundle) => {
    const engagementTraffic = hasEngagement(bundle) ? bundle.weight : 0;
    if (!urlsData[bundle.url]) {
      urlsData[bundle.url] = {
        url: bundle.url,
        totalTraffic: bundle.weight,
        engagementTraffic,
        engagementPercentage: (engagementTraffic / bundle.weight) * 100,
      };
    } else {
      urlsData[bundle.url].totalTraffic += bundle.weight;
      urlsData[bundle.url].engagementTraffic += engagementTraffic;
      urlsData[bundle.url].engagementPercentage = (
        urlsData[bundle.url].engagementTraffic / urlsData[bundle.url].totalTraffic
      ) * 100;
    }
  });

  return Object.values(urlsData);
}

export default {
  handler,
  checkpoints: ['click', 'viewmedia', 'viewblock'],
};
