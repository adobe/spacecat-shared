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

const FORM_SOURCE = ['.form', '.marketo', '.marketo-form'];
const BOT = 'bot';

function collectFormVitals(bundles) {
  const results = {};

  // Accumulate counts by user agent
  const accumulateByUserAgent = (userAgentCounts, userAgent, weight) => {
    if (userAgent && !userAgent.startsWith(BOT)) {
      if (!userAgentCounts[userAgent]) {
        // eslint-disable-next-line no-param-reassign
        userAgentCounts[userAgent] = 0;
      }
      // eslint-disable-next-line no-param-reassign
      userAgentCounts[userAgent] += weight;
    }
  };

  for (const bundle of bundles) {
    const {
      url, userAgent, weight, events,
    } = bundle;

    // Initialize the URL entry in the result if not already present
    if (!results[url]) {
      results[url] = {
        url,
        formsubmit: {},
        formview: {},
        formengagement: {},
      };
    }

    // Reference the current URL’s data object in the results
    const urlData = results[url];
    // Track if each condition has been processed for this event
    const processedCheckpoints = new Set();

    // Process each event within the bundle
    for (const event of events) {
      const { checkpoint, source } = event;

      // Only process the checkpoint once per event
      if (!processedCheckpoints.has(checkpoint)) {
        // Check for 'viewblock' checkpoint indicating form views
        if (checkpoint === 'viewblock' && FORM_SOURCE.includes(source)) {
          accumulateByUserAgent(urlData.formview, userAgent, weight);
          processedCheckpoints.add('viewblock'); // Mark as processed
        }
        // Check for 'formsubmit' checkpoint indicating form submissions
        if (checkpoint === 'formsubmit') {
          accumulateByUserAgent(urlData.formsubmit, userAgent, weight);
          processedCheckpoints.add('formsubmit'); // Mark as processed
        }
        // Check for 'click' checkpoint with source indicating form engagement
        if (checkpoint === 'click' && source && /\bform\b/.test(source.toLowerCase())) {
          accumulateByUserAgent(urlData.formengagement, userAgent, weight);
          processedCheckpoints.add('click'); // Mark as processed
        }
      }
    }
  }

  return results;
}

function pageviewsByUrlAndUserAgent(bundles) {
  return bundles.reduce((acc, cur) => {
    const { userAgent } = cur;
    if (!userAgent || userAgent.startsWith(BOT)) return acc;
    // Initialize the URL object if it doesn't exist
    acc[cur.url] = acc[cur.url] || {};
    // Initialize the userAgent count if it doesn't exist
    acc[cur.url][userAgent] = (acc[cur.url][userAgent] || 0) + cur.weight;
    return acc;
  }, {});
}

function handler(bundles) {
  const pageviews = pageviewsByUrlAndUserAgent(bundles);
  const formVitals = collectFormVitals(bundles);

  return Object.values(formVitals)
    .map((acc) => {
      acc.pageview = pageviews[acc.url];
      return acc;
    })
    .filter((item) => {
      // Calculate the sum of values in formView, formSubmit, and formEngagement
      const formViewSum = Object.values(item.formview).reduce((sum, value) => sum + value, 0);
      const formSubmitSum = Object.values(item.formsubmit).reduce((sum, value) => sum + value, 0);
      // eslint-disable-next-line max-len
      const formEngagementSum = Object.values(item.formengagement).reduce((sum, value) => sum + value, 0);

      // Check if any of the sums is greater than zero
      return formViewSum > 0 || formSubmitSum > 0 || formEngagementSum > 0;
    });
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click', 'error', 'top'],
};
