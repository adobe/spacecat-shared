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

const popupSource = 'dialog img.logo';
const popupTarget = 'https://image.insider.wilson.com/lib/fe8d12747560037b72/m/1/2929c817-5e1a-4d36-9e73-09b600d5d5d8.png';

const declineButton = 'dialog .evg-opt-out-msg';
const acceptButton = 'dialog button#evg-btn-continue';

function handler(bundles) {
  const dataChunks = new DataChunks();

  loadBundles(
    bundles.filter((bundle) => bundle.url.includes('en-us')),
    dataChunks,
  );

  dataChunks.addFacet('userAgent', (bundle) => {
    const agent = bundle.userAgent.split(':')[0];
    return agent || null;
  });

  dataChunks.addSeries('popupShown', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'viewmedia')
      .find((e) => e.source === popupSource && e.target === popupTarget);
    return isEngaged ? bundle.weight : 0;
  });

  dataChunks.addSeries('offerAccepted', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .find((e) => e.source === acceptButton);
    return isEngaged ? bundle.weight : 0;
  });

  dataChunks.addSeries('offerDeclined', (bundle) => {
    const isEngaged = bundle.events
      .filter((e) => e.checkpoint === 'click')
      .find((e) => e.source === declineButton);
    return isEngaged ? bundle.weight : 0;
  });

  const result = dataChunks.facets.userAgent.map((facet) => {
    const popupShown = facet.metrics.popupShown.sum;
    const popupNotShown = facet.weight - popupShown;
    const offerAccepted = facet.metrics.offerAccepted.sum;
    const offerDeclined = facet.metrics.offerDeclined.sum;

    return {
      device: facet.value,
      pageviews: facet.weight,
      popupShown,
      popupNotShown,
      offerAccepted,
      offerDeclined,
      bounced: popupShown - (offerAccepted + offerDeclined),
    };
  });

  return result;
}

export default {
  handler,
  checkpoints: ['click', 'viewmedia'],
};
