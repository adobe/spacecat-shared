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
