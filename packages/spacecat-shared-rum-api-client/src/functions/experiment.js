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
import { generateKey, DELIMITER, loadBundles } from '../utils.js';

const METRICS = ['click', 'convert', 'formsubmit'];

const experimentsFacetFn = (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment').map((e) => generateKey(bundle.url, e.source));
const variantsFacetFn = (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment').map((e) => generateKey(bundle.url, e.source, e.target));

const checkpointsFacetFn = (bundle) => {
  const experiments = bundle.events.filter((e) => e.checkpoint === 'experiment');
  const metrics = bundle.events.filter((c) => METRICS.includes(c.checkpoint) && c.source);

  const keys = experiments.flatMap(
    (exp) => metrics.flatMap((metric) => [
      generateKey(bundle.url, exp.source, exp.target, metric.checkpoint, metric.source),
      generateKey(bundle.url, exp.source, exp.target, metric.checkpoint, '*'),
    ]),
  );

  return [...new Set(keys)];
};

function handler(bundles) {
  const dataChunks = new DataChunks();

  loadBundles(bundles.filter((bundle) => bundle.events.some((event) => event.checkpoint === 'experiment')), dataChunks);

  dataChunks.addFacet('experiments', experimentsFacetFn);
  dataChunks.addFacet('variants', variantsFacetFn);
  dataChunks.addFacet('checkpoints', checkpointsFacetFn);

  dataChunks.addSeries('experimenttime', (bundle) => new Date(bundle.time).getTime());
  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('interaction', (bundle) => (bundle.events.find((e) => e.checkpoint === 'click' || e.checkpoint === 'formsubmit' || e.checkpoint === 'convert') ? bundle.weight : undefined));

  const { experiments, variants, checkpoints } = dataChunks.facets;

  const result = {};
  experiments.forEach((uev) => {
    const [url, experiment] = uev.value.split(DELIMITER);
    if (!result[url]) result[url] = [];
    result[url].push({
      experiment,
      variants: [],
      inferredStartDate: new Date(uev.metrics.experimenttime.min).toISOString(),
      inferredEndDate: new Date(uev.metrics.experimenttime.max).toISOString(),
    });
  });
  variants.forEach((uev) => {
    const [url, experiment, variant] = uev.value.split(DELIMITER);
    const eIdx = result[url].findIndex((e) => e.experiment === experiment);
    result[url][eIdx].variants.push({
      name: variant,
      click: {},
      formsubmit: {},
      convert: {},
      interactionsCount: uev.metrics.interaction.sum,
      samples: uev.metrics.views.count,
      views: uev.metrics.views.sum,
    });
  });
  checkpoints.forEach((uev) => {
    const [url, experiment, variant, checkpoint, source] = uev.value.split(DELIMITER);
    const eIdx = result[url].findIndex((e) => e.experiment === experiment);
    const vIdx = result[url][eIdx].variants.findIndex((v) => v.name === variant);

    result[url][eIdx].variants[vIdx][checkpoint][source] = {
      value: uev.metrics.views.sum,
      samples: uev.metrics.views.count,
    };
  });

  return result;
}

export default {
  handler,
  checkpoints: [...METRICS, 'experiment'],
};
