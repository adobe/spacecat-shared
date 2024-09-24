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
const DEFAULT_RAGE_CLICK_THRESHOLD = 10;
const DEFAULT_RAGECLICK_PERCENT_THRESHOLD = 5;
const DEFAULT_MINIMUM_RAGECLICK_SAMPLES_THRESHOLD = 10;
const DEFAULT_RAGECLICK_SAMPLES_THRESHOLD = 100;
const DEFAULT_RAGECLICK_PAGEVIEW_THRESHOLD = 5000;

const COMMERCE_SELECTORS_IGNORE_LIST = [
  '.product-list-page',
  '.product-details-verb',
  '.product-details',
];

const EDS_BLOCK_SELECTORS_IGNORE_LIST = ['.accordion'];

const RAGECLICK_SELECTORS_IGNORE_LIST = [
  ...COMMERCE_SELECTORS_IGNORE_LIST,
  ...EDS_BLOCK_SELECTORS_IGNORE_LIST,
];

const OPPORTUNITY_TYPE = 'rageclick';
const OPPORTUNITY_DESCRIPTION = 'The percentage of users who click on the same element lot of times in a short period of time.';

/**
 * Returns the selectors that have more than DEFAULT_RAGE_CLICK_THRESHOLD clicks from the events
 * @param {*} events
 * @returns
 */
function getRageClickSelectors(events, threshold, selectorsIgnoreList = []) {
  const clickSelectors = {};
  for (const event of events) {
    const { source, target, checkpoint } = event;
    if (checkpoint === 'click' && !selectorsIgnoreList.includes(source)) {
      if (!clickSelectors[source]) {
        clickSelectors[source] = {
          value: 0,
          target: {
            [target]: 0,
          },
        };
      }
      clickSelectors[source].value += 1;
      if (!clickSelectors[source].target[target]) {
        clickSelectors[source].target[target] = 1;
      } else {
        clickSelectors[source].target[target] += 1;
      }
    }
  }
  for (const selector of Object.keys(clickSelectors)) {
    if (clickSelectors[selector].value < threshold) {
      delete clickSelectors[selector];
    }
  }
  return clickSelectors;
}

function filterRageClickInstancesByThreshold(
  rageClickInstances,
  pageData,
  thresholds,
) {
  for (const url of Object.keys(rageClickInstances)) {
    if (pageData[url].pageViews < thresholds.rageClickPageviewThreshold) {
      // eslint-disable-next-line no-param-reassign
      delete rageClickInstances[url];
    } else {
      for (const selector of Object.keys(rageClickInstances[url])) {
        const rageClickPercentage = (
          rageClickInstances[url][selector].samples / pageData[url].samples) * 100;
        if ((rageClickInstances[url][selector].samples >= thresholds.rageClickMinSamplesThreshold
          && rageClickPercentage >= thresholds.rageClickPercentThreshold)
          || rageClickInstances[url][selector].samples >= thresholds.rageClickSamplesThreshold) {
          // eslint-disable-next-line no-param-reassign
          rageClickInstances[url][selector].percentage = rageClickPercentage;
        } else {
          // eslint-disable-next-line no-param-reassign
          delete rageClickInstances[url][selector];
        }
      }
      if (Object.keys(rageClickInstances[url]).length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete rageClickInstances[url];
      } else {
        // eslint-disable-next-line no-param-reassign
        rageClickInstances[url].pageViews = pageData[url].pageViews;
        // eslint-disable-next-line no-param-reassign
        rageClickInstances[url].samples = pageData[url].samples;
      }
    }
  }
}

function getRageClickOpportunities(rageClickInstances) {
  const opportunities = [];
  for (const url of Object.keys(rageClickInstances)) {
    const opportunity = {
      type: OPPORTUNITY_TYPE,
      page: url,
      screenshot: '',
      trackedPageKPIName: OPPORTUNITY_DESCRIPTION,
      trackedPageKPIValue: '',
      trackedKPISiteAverage: '',
      pageViews: rageClickInstances[url].pageViews,
      samples: rageClickInstances[url].samples,
      metrics: [],
    };
    for (const selector of Object.keys(rageClickInstances[url])) {
      if (typeof rageClickInstances[url][selector] === 'object') {
        opportunity.metrics.push({
          type: 'click',
          selector,
          targets: rageClickInstances[url][selector].target,
          value: rageClickInstances[url][selector].value,
          samples: rageClickInstances[url][selector].samples,
          percentage: rageClickInstances[url][selector].percentage,
          mobileSamples: rageClickInstances[url][selector].mobileSamples,
          desktopSamples: rageClickInstances[url][selector].desktopSamples,
        });
      }
    }
    const avgRageClickPercentage = opportunity.metrics.reduce(
      (acc, metric) => acc + metric.percentage,
      0,
    ) / opportunity.metrics.length;
    opportunity.trackedPageKPIValue = avgRageClickPercentage;
    opportunities.push(opportunity);
  }
  return opportunities;
}

function handler(bundles) {
  const rageClickInstances = {};
  const pageData = {};
  const rageClickThreshold = process.env.RAGE_CLICK_THRESHOLD || DEFAULT_RAGE_CLICK_THRESHOLD;
  const rageClickPercentThreshold = process.env.RAGE_CLICK_PERCENT_THRESHOLD
  || DEFAULT_RAGECLICK_PERCENT_THRESHOLD;
  const rageClickPageviewThreshold = process.env.RAGE_CLICK_PAGEVIEW_THRESHOLD
  || DEFAULT_RAGECLICK_PAGEVIEW_THRESHOLD;
  const rageClickMinSamplesThreshold = process.env.RAGE_CLICK_MIN_SAMPLES_THRESHOLD
  || DEFAULT_MINIMUM_RAGECLICK_SAMPLES_THRESHOLD;
  const rageClickSamplesThreshold = process.env.RAGE_CLICK_SAMPLES_THRESHOLD
  || DEFAULT_RAGECLICK_SAMPLES_THRESHOLD;
  const thresholds = {
    rageClickPercentThreshold,
    rageClickPageviewThreshold,
    rageClickMinSamplesThreshold,
    rageClickSamplesThreshold,
  };
  for (const bundle of bundles) {
    const { url, weight } = bundle;
    if (!pageData[url]) {
      pageData[url] = {
        pageViews: weight,
        samples: 1,
      };
    } else {
      pageData[url].pageViews += weight;
      pageData[url].samples += 1;
    }
    const rageClickSelectors = getRageClickSelectors(
      bundle.events,
      rageClickThreshold,
      RAGECLICK_SELECTORS_IGNORE_LIST,
    );
    const isMobile = bundle.userAgent && bundle.userAgent.includes('mobile');
    if (Object.keys(rageClickSelectors).length > 0) {
      if (!rageClickInstances[url]) {
        rageClickInstances[url] = {};
      }
      for (const selector of Object.keys(rageClickSelectors)) {
        if (!rageClickInstances[url][selector]) {
          rageClickInstances[url][selector] = {};
          rageClickInstances[url][selector].value = rageClickSelectors[selector].value;
          rageClickInstances[url][selector].samples = 1;
          rageClickInstances[url][selector].target = rageClickSelectors[selector].target;
          rageClickInstances[url][selector].mobileSamples = isMobile ? 1 : 0;
          rageClickInstances[url][selector].desktopSamples = !isMobile ? 1 : 0;
        } else {
          rageClickInstances[url][selector].value += rageClickSelectors[selector].value;
          rageClickInstances[url][selector].samples += 1;
          rageClickInstances[url][selector].mobileSamples += isMobile ? 1 : 0;
          rageClickInstances[url][selector].desktopSamples += !isMobile ? 1 : 0;
          for (const target of Object.keys(rageClickSelectors[selector].target)) {
            if (!rageClickInstances[url][selector].target[target]) {
              // eslint-disable-next-line max-len
              rageClickInstances[url][selector].target[target] = rageClickSelectors[selector].target[target];
            } else {
              // eslint-disable-next-line max-len
              rageClickInstances[url][selector].target[target] += rageClickSelectors[selector].target[target];
            }
          }
        }
      }
    }
  }
  filterRageClickInstancesByThreshold(rageClickInstances, pageData, thresholds);
  return getRageClickOpportunities(rageClickInstances);
}

export default {
  handler,
  checkpoints: ['click'],
};
/* c8 ignore stop */
