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

import { DataChunks } from '@adobe/rum-distiller';
import { loadBundles } from '../../utils.js';

const cookieEngagementSources = [
  '#reject-all-cookies',
  'save-preference-btn-handler',
  'onetrust-accept-btn-handler',
];

const recipesSource = '#reeses-caramel-recipes';

function handler(bundles) {
  const dataChunks = new DataChunks();

  const reeses = bundles.filter((b) => b.url.startsWith('https://www.hersheyland.com/reeses'));
  const filtered = reeses.filter((b) => !b.events.some((e) => e.checkpoint === 'missingresource'));

  // Filter bundles for the desired URL.
  loadBundles(filtered, dataChunks);

  // Facet: group bundles by day (from bundle.time) and by consent category.
  dataChunks.addFacet('variants', (bundle) => {
    const experiment = bundle.events.find((e) => e.checkpoint === 'experiment');
    if (!experiment) return null;

    if (bundle.weight === 1) return null; // ignore debugging bundles

    return experiment.target;
  });

  dataChunks.addSeries('ctr', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .filter((e) => !cookieEngagementSources.some((s) => e.source?.includes(s)));
    return isEngaged.length > 0 ? 1 : 0;
  });

  dataChunks.addSeries('cookieCtr', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .filter((e) => cookieEngagementSources.some((s) => e.source?.includes(s)));
    return isEngaged.length > 0 ? 1 : 0;
  });

  dataChunks.addSeries('recipesSeen', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'viewmedia')
      .filter((e) => e.source?.startsWith(recipesSource));
    return isEngaged.length > 0 ? 1 : 0;
  });

  const result = dataChunks.facets.variants.map((facet) => ({
    variant: facet.value,
    nonCookieClicks: facet.metrics.ctr.sum,
    nonCookieCTR: (facet.metrics.ctr.sum / facet.count).toFixed(4),
    cookieClicks: facet.metrics.cookieCtr.sum,
    cookieCtr: (facet.metrics.cookieCtr.sum / facet.count).toFixed(4),
    recipesSeen: (facet.metrics.recipesSeen.sum / facet.count).toFixed(4),
    totalSamples: facet.count,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(result);
  return result;
}

export default {
  handler,
  checkpoints: ['viewmedia', 'click', 'experiment', 'missingresource'],
};
