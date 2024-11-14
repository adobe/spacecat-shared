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
const CHECKPOINT_MAPPING = { formsubmit: 'formsubmit', viewblock: 'formview', click: 'formengagement' };

function initializeResult(url, pageViews) {
  return {
    url,
    formsubmit: {},
    formview: {},
    formengagement: {},
    pageview: pageViews[url],
  };
}

function collectFormVitals(bundles, pageViews) {
  const results = {};

  // Helper functions to identify event types
  const isFormViewEvent = ({ checkpoint, source }) => checkpoint === 'viewblock' && FORM_SOURCE.includes(source);
  const isFormClickEvent = ({ checkpoint, source }) => checkpoint === 'click' && source && /\bform\b/.test(source.toLowerCase());
  const isFormSubmitEvent = ({ checkpoint }) => checkpoint === 'formsubmit';

  for (const bundle of bundles) {
    const {
      url, userAgent, weight, events,
    } = bundle;

    if (userAgent && !userAgent.startsWith(BOT)) {
      // Track if each condition has been processed for this event
      const processedCheckpoints = {
        viewblock: false,
        formsubmit: false,
        click: false,
      };

      // Process each event within the bundle
      for (const event of events) {
        const { checkpoint, source } = event;

        // Only process the checkpoint once per event
        if (!processedCheckpoints[checkpoint]) {
          if (isFormViewEvent({ checkpoint, source })
              || isFormSubmitEvent({ checkpoint })
              || isFormClickEvent({ checkpoint, source })) {
            results[url] = results[url] || initializeResult(url, pageViews);
            const key = CHECKPOINT_MAPPING[checkpoint];
            const res = results[url];
            res[key] = {
              ...res[key],
              [userAgent]: (res[key][userAgent] || 0) + weight,
            };
            // Mark this checkpoint as processed
            processedCheckpoints[checkpoint] = true;
          }
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
    acc[cur.url] = acc[cur.url] || {};
    acc[cur.url][userAgent] = (acc[cur.url][userAgent] || 0) + cur.weight;
    return acc;
  }, {});
}

function handler(bundles) {
  const pageViews = pageviewsByUrlAndUserAgent(bundles);
  const formVitals = collectFormVitals(bundles, pageViews);
  return Object.values(formVitals);
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click', 'error', 'top'],
};
