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

import { DataChunks, series } from '@adobe/rum-distiller';
import { DELIMITER, generateKey, loadBundles } from '../utils.js';
/**
 * Processes RUM data to identify broken internal links associated views.
 * Uses the 404 and navigate checkpoints to identify broken internal links.
 * The handler function:
 * 1. Loads RUM bundles into data chunks
 * 2. Groups data by unique URL combinations (404 target URL + source URL)
 * 3. Calculates pageviews for each broken link. Duplicate combinations will have
 * their views summed.
 * 4. Returns array of broken link objects with:
 *    - url_to: The 404 target URL that is broken
 *    - url_from: The source URL containing the broken link
 *    - views: Number of pageviews to the broken URL
 * @param {Array} bundles - Array of RUM data bundles
 * @returns {Array} Array of broken internal link objects with views
 */

function handler(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // groups by combination of url and 404 source
  dataChunks.addFacet('uniqueUrlCombinations', (bundle) => {
    const eventNavigate = bundle.events.find((e) => e.checkpoint === 'navigate');
    const event404 = bundle.events.find((e) => e.checkpoint === '404');
    if (eventNavigate && event404) {
      return generateKey(bundle.url, event404.source);
    }
    return undefined;
  });

  // counts pageviews per each group
  dataChunks.addSeries('views', series.pageViews);

  return dataChunks.facets.uniqueUrlCombinations.map((facet) => {
      const [urlTo, urlFrom] = facet.value.split(DELIMITER);
      
      return {
         views: facet.metrics.views.sum,
         url_to: urlTo,
         url_from: urlFrom,
      }
    });
}

export default {
  handler,
  checkpoints: ['404', 'navigate'],
};
