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

import { series } from '@adobe/rum-distiller';

const evaluateEngagement = (bundle) => {
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

const evaluateOrganicEngagement = (bundle) => {
  const organicWeight = series.organic(bundle);
  if (!organicWeight) {
    return 0;
  }
  const hasClick = bundle.events.some((evt) => evt.checkpoint === 'click');
  const hasContentEngagement = bundle.events
    .filter((evt) => evt.checkpoint === 'viewmedia' || evt.checkpoint === 'viewblock')
    .length > 3;
  return (hasClick || hasContentEngagement) ? organicWeight : 0;
};

/**
 * Calculates engagement metrics for all pages from RUM data.
 * A page view is considered engaged if there has been at least some user interaction (click events)
 * or significant content has been viewed (4 or more viewmedia or viewblock events).
 * Ref. - https://github.com/adobe/rum-distiller/blob/22f8b3caa6d700f4d1cbe29a94b7da34b9d50764/series.js#L89
 *
 * @param {Array} bundles - The RUM bundles to calculate engagement metrics for.
 * @returns {Array} An array of engagement metrics for each page (total and organic-only).
 */
function handler(bundles) {
  const urlsData = {};
  bundles.forEach((bundle) => {
    const engagementTraffic = evaluateEngagement(bundle);
    const organicWeight = series.organic(bundle) ?? 0;
    const engagementTrafficOrganic = evaluateOrganicEngagement(bundle);

    if (!urlsData[bundle.url]) {
      urlsData[bundle.url] = {
        url: bundle.url,
        totalTraffic: bundle.weight,
        engagementTraffic,
        engagementPercentage: (engagementTraffic / bundle.weight) * 100,
        totalOrganicTraffic: organicWeight,
        engagementTrafficOrganic,
        engagementPercentageOrganic: organicWeight > 0 && engagementTrafficOrganic > 0
          ? Math.round((engagementTrafficOrganic / organicWeight) * 100)
          : 0,
      };
    } else {
      const row = urlsData[bundle.url];
      row.totalTraffic += bundle.weight;
      row.engagementTraffic += engagementTraffic;
      row.engagementPercentage = Math.round(
        (row.engagementTraffic / row.totalTraffic) * 100,
      );
      row.totalOrganicTraffic += organicWeight;
      row.engagementTrafficOrganic += engagementTrafficOrganic;
      row.engagementPercentageOrganic = row.totalOrganicTraffic > 0
        && row.engagementTrafficOrganic > 0
        ? Math.round((row.engagementTrafficOrganic / row.totalOrganicTraffic) * 100)
        : 0;
    }
  });

  return Object.values(urlsData);
}

export default {
  handler,
  checkpoints: ['click', 'viewmedia', 'viewblock', 'enter', 'utm', 'paid', 'email'],
};
