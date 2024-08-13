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
 * return the pages that have rage clicks along with selectors and number of clicks
 * @param {*} bundles
 * @returns
 */

/* c8 ignore start */
const RAGE_CLICK_THRESHOLD = 10;
const SAMPLE_THRESHOLD = 10;

function getRageClickSelectors(events) {
  const clickSelectors = {};
  for (const event of events) {
    if (event.checkpoint === 'click') {
      const { source } = event;
      if (!clickSelectors[source]) {
        clickSelectors[source] = 0;
      }
      clickSelectors[source] += 1;
    }
  }
  for (const selector of Object.keys(clickSelectors)) {
    if (clickSelectors[selector] < RAGE_CLICK_THRESHOLD) {
      delete clickSelectors[selector];
    }
  }
  return clickSelectors;
}

function handler(bundles) {
  const rageClickInstances = {};
  const pageViews = {};
  for (const bundle of bundles) {
    const { url, weight } = bundle;
    pageViews[url] = (pageViews[url] || 0) + weight;
    const rageClickSelectors = getRageClickSelectors(bundle.events);
    if (Object.keys(rageClickSelectors).length > 0) {
      if (!rageClickInstances[url]) {
        rageClickInstances[url] = {};
      }
      for (const selector of Object.keys(rageClickSelectors)) {
        if (!rageClickInstances[url][selector]) {
          rageClickInstances[url][selector] = {};
          rageClickInstances[url][selector].value = rageClickSelectors[selector];
          rageClickInstances[url][selector].samples = 1;
        } else {
          rageClickInstances[url][selector].value += rageClickSelectors[selector];
          rageClickInstances[url][selector].samples += 1;
        }
      }
    }
  }
  for (const url of Object.keys(rageClickInstances)) {
    for (const selector of Object.keys(rageClickInstances[url])) {
      if (rageClickInstances[url][selector].samples < SAMPLE_THRESHOLD) {
        delete rageClickInstances[url][selector];
      }
    }
    if (Object.keys(rageClickInstances[url]).length === 0) {
      delete rageClickInstances[url];
    } else {
      rageClickInstances[url].pageViews = pageViews[url];
    }
  }
  return rageClickInstances;
}

export default {
  handler,
  checkpoints: ['click'],
};
/* c8 ignore stop */
