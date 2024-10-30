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

import { FlatBundle } from '../common/flat-bundle.js';

function collectFormVitals(groupedByUrlId) {
  const { url, items: itemsByUrlId } = groupedByUrlId;

  const visitedUrls = new Set(); // To store visited URLs for views
  const result = itemsByUrlId
    .flatMap((item) => item.items)
    .reduce((acc, cur) => {
      const uniqueId = `${cur.url}_${cur.id}`;

      // Early return if the URL has been visited
      if (visitedUrls.has(uniqueId)) return acc;

      // Initialize userAgentCount if it hasn't been yet
      if (!acc.formSubmitByUserAgent) {
        acc.formSubmitByUserAgent = {};
      }

      // Check for 'viewblock' checkpoint
      if (cur && cur.checkpoint === 'viewblock' && cur.source === '.form') {
        visitedUrls.add(uniqueId);
        acc.formViews += cur.weight;
        acc.isFormViewPresent = true;
      } else if (cur && cur.checkpoint === 'formsubmit') {
        // Check for 'formsubmit' checkpoint
        visitedUrls.add(uniqueId);
        acc.formSubmits += cur.weight;
        acc.isFormSubmitPresent = true;

        // Accumulate user agent
        const userAgent = cur.userAgent || 'unknown'; // Default to 'unknown' if not present
        if (!acc.formSubmitByUserAgent[userAgent]) {
          acc.formSubmitByUserAgent[userAgent] = 0;
        }
        acc.formSubmitByUserAgent[userAgent] += cur.weight; // Accumulate weight for this user agent
        // for business adobe com  cur.source.toLowerCase().includes('#mktoButton_new')
      } else if (cur && cur.checkpoint === 'click' && cur.source && /\bform\b/.test(cur.source.toLowerCase())) {
        // Check for 'click' checkpoint
        visitedUrls.add(uniqueId);
        acc.formSubmitButtonClicks += cur.weight;
        acc.isFormSubmitButtonClickPresent = true;
      } else if (cur && cur.checkpoint === 'error') {
        // Check for 'error' checkpoint
        visitedUrls.add(uniqueId);
        acc.errors += cur.weight;
      }
      return acc;
    }, {
      formViews: 0,
      errors: 0,
      formSubmits: 0,
      formSubmitButtonClicks: 0,
      isFormViewPresent: false,
      isFormSubmitPresent: false,
      isFormSubmitButtonClickPresent: false,
    });

  // Check if any condition was met; if not, return undefined
  const { isFormViewPresent, isFormSubmitPresent, isFormSubmitButtonClickPresent } = result;
  if (!isFormViewPresent && !isFormSubmitPresent && !isFormSubmitButtonClickPresent) {
    return undefined;
  }

  return {
    url,
    formViews: result.formViews,
    formSubmits: result.formSubmits,
    formSubmitByUserAgent: result.formSubmitByUserAgent,
    errors: result.errors,
    formSubmitButtonClicks: result.formSubmitButtonClicks,
    isFormViewPresent: result.isFormViewPresent,
    isFormSubmitPresent: result.isFormSubmitPresent,
  };
}

function updateFormViewsIfNotPresent(acc) {
  // If formViews is 0 and isFormViewPresent is false, set formViews to pageviews
  if (acc.formViews === 0 && acc.isFormViewPresent === false) {
    acc.formViews = acc.pageviews;
  }
  return acc;
}

function pageviewsByUrlAndUserAgent(bundles) {
  return bundles.reduce((acc, cur) => {
    const userAgent = cur.userAgent || 'unknown';

    // Check if the user agent starts with "bot:"
    if (!userAgent.startsWith('bot')) {
      if (!acc[cur.url]) {
        acc[cur.url] = { weight: 0 };
      }

      acc[cur.url].weight += cur.weight;
      if (!acc[cur.url][userAgent]) {
        acc[cur.url][userAgent] = 0;
      }
      acc[cur.url][userAgent] += cur.weight;
    }

    return acc;
  }, {});
}

function handler(bundles) {
  const pageviews = pageviewsByUrlAndUserAgent(bundles);

  return FlatBundle.fromArray(bundles)
    .groupBy('url', 'id')
    .map(collectFormVitals)
    .filter((item) => item !== undefined)
    .map((acc) => {
      acc.pageviews = pageviews[acc.url].weight;
      // removing weight property
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { weight, ...userAgents } = pageviews[acc.url];
      acc.pageviewsByUserAgent = userAgents;
      return acc;
    })
    .map(updateFormViewsIfNotPresent)
    .sort((a, b) => b.views - a.views); // sort desc by views
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click', 'error'],
};
