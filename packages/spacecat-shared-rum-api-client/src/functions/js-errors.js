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

import { DataChunks } from '@adobe/rum-distiller';
import { loadBundles } from '../utils.js';

function handler(bundles, opts = {}) {
  const dataChunks = new DataChunks();

  // Filter by URLs only if provided
  const filteredBundles = opts.urls
    ? bundles.filter((bundle) => opts.urls.includes(bundle.url))
    : bundles;

  loadBundles(filteredBundles, dataChunks);

  const errorSourceCounts = {};
  const placeOrderSelectors = opts.selectors || [];

  let totalPlaceOrderClicks = 0;

  // Helper function to check if a click matches any place order selector
  function matchesSelector(click) {
    return placeOrderSelectors.some((selector) => click.source === selector);
  }

  dataChunks.addSeries('jsErrors', (bundle) => {
    const hasErrors = bundle.events.some((e) => e.checkpoint === 'error');

    if (hasErrors) {
      const errors = bundle.events.filter((e) => e.checkpoint === 'error');
      const clicks = bundle.events.filter((e) => e.checkpoint === 'click');

      // Check if there was a place order click in this bundle (only if selectors are provided)
      const hasPlaceOrderClick = placeOrderSelectors.length > 0 && clicks.some(matchesSelector);

      // Count total place order clicks (only if selectors are provided)
      if (placeOrderSelectors.length > 0) {
        const placeOrderClicksInBundle = clicks.filter(
          (click) => placeOrderSelectors.some((selector) => click.source === selector),
        ).length;

        totalPlaceOrderClicks += placeOrderClicksInBundle * bundle.weight;
      }

      // Get unique error sources from this bundle (deduplicate within the bundle)
      const uniqueErrorSources = [
        ...new Set(errors.map((e) => e.source).filter((source) => source)),
      ];

      // For each unique error source in this bundle, add the bundle weight once
      uniqueErrorSources.forEach((source) => {
        if (!errorSourceCounts[source]) {
          errorSourceCounts[source] = {
            count: 0,
            placeOrderCount: 0,
          };
        }

        errorSourceCounts[source].count += bundle.weight;

        if (hasPlaceOrderClick) {
          errorSourceCounts[source].placeOrderCount += bundle.weight;
        }
      });
    }

    return hasErrors ? bundle.weight : 0;
  });

  const totalViews = filteredBundles.reduce((sum, bundle) => sum + bundle.weight, 0);
  const totalJsErrors = dataChunks?.totals?.jsErrors?.sum ?? 0;
  const totalJsErrorPercentage = totalViews > 0
    ? `${((totalJsErrors / totalViews) * 100).toFixed(2)}%`
    : '0%';

  // If no selectors provided, show N/A
  const finalTotalPlaceOrderClicks = placeOrderSelectors.length > 0
    ? totalPlaceOrderClicks
    : 'N/A';

  let totalPlaceOrderPercentage;
  if (placeOrderSelectors.length === 0) {
    totalPlaceOrderPercentage = 'N/A';
  } else if (totalViews > 0) {
    totalPlaceOrderPercentage = `${((totalPlaceOrderClicks / totalViews) * 100).toFixed(2)}%`;
  } else {
    totalPlaceOrderPercentage = '0%';
  }

  const errorDetails = Object.keys(errorSourceCounts)
    .map((source) => {
      let placeOrderValue;
      if (placeOrderSelectors.length === 0) {
        placeOrderValue = 'N/A';
      } else {
        placeOrderValue = errorSourceCounts[source].placeOrderCount > 0 ? 'Yes' : 'No';
      }

      return {
        source,
        count: errorSourceCounts[source].count,
        totalViewsPercentage: totalViews > 0
          ? `${((errorSourceCounts[source].count / totalViews) * 100).toFixed(2)}%`
          : '0%',
        placeOrder: placeOrderValue,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalViews,
    totalPlaceOrderClicks: finalTotalPlaceOrderClicks,
    totalPlaceOrderPercentage,
    totalJsErrors,
    totalJsErrorPercentage,
    errorDetails,
  };
}

export default {
  handler,
  checkpoints: ['error', 'click'],
};
