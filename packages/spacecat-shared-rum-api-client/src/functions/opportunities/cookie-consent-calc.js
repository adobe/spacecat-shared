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

const acceptedSource = 'onetrust-accept-btn-handler';

function handler(bundles) {
  const dataChunks = new DataChunks();

  loadBundles(bundles.filter((b) => b.url.includes('/en-us')), dataChunks);

  dataChunks.addFacet('variants', (bundle) => {
    const experiment = bundle.events.find((e) => e.checkpoint === 'experiment');
    if (!experiment) return null;

    if (bundle.weight === 1) return null; // ignore debugging bundles

    return experiment.target;
  });

  dataChunks.addSeries('cookieEngaged', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .filter((e) => cookieEngagementSources.some((s) => e.source?.includes(s)));

    // count each sample as 1
    return isEngaged.length > 0 ? 1 : 0;
  });

  dataChunks.addSeries('cookieAccepted', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .filter((e) => e.source?.includes(acceptedSource));

    // count each sample as 1
    return isEngaged.length > 0 ? 1 : 0;
  });

  const result = dataChunks.facets.variants.map((facet) => {
    const variant = facet.value;

    const { cookieEngaged, cookieAccepted } = facet.metrics;

    return {
      variant,
      acceptedRatio: cookieAccepted.sum / facet.count,
      acceptedCount: cookieAccepted.sum,
      engagedRatio: cookieEngaged.sum / facet.count,
      engagedCount: cookieEngaged.sum,
      totalSamples: facet.count,
    };
  });

  console.log();

  return result;
}

export default {
  handler,
  checkpoints: ['click', 'consent', 'experiment'],
};
