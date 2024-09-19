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

import { DataChunks } from '../common/cruncher.js';

function handler(bundles) {
  const dataChunks = new DataChunks();

  dataChunks.load(bundles);

  dataChunks.addFacet('experiments', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment').map((e) => `${bundle.url}\u3343${e.source}`));
  dataChunks.addFacet('variants', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment').map((e) => `${bundle.url}\u3343${e.source}\u3343${e.target}`));
  dataChunks.addFacet('checkpoints', (bundle) => [...new Set(bundle.events.filter((e) => e.checkpoint === 'experiment')
    .flatMap((e) => bundle.events.filter((c) => ['click', 'formsubmit', 'convert'].includes(c.checkpoint) && c.source).flatMap((c) => [`${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.checkpoint}\u3343${c.source}`, `${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.checkpoint}\u3343*`])))]);

  dataChunks.addSeries('experimenttime', (bundle) => new Date(bundle.time).getTime());

  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('interaction', (bundle) => (bundle.events.find((e) => e.checkpoint === 'click' || e.checkpoint === 'formsubmit' || e.checkpoint === 'convert') ? bundle.weight : undefined));

  const { experiments, variants, checkpoints } = dataChunks.facets;

  const result = {};
  experiments.forEach((uev) => {
    const [url, experiment] = uev.value.split('\u3343');
    if (!result[url]) result[url] = [];
    result[url].push({
      experiment,
      variants: [],
      inferredStartDate: new Date(uev.metrics.experimenttime.min).toISOString(),
      inferredEndDate: new Date(uev.metrics.experimenttime.max).toISOString(),
    });
  });
  variants.forEach((uev) => {
    const [url, experiment, variant] = uev.value.split('\u3343');
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
    const [url, experiment, variant, checkpoint, source] = uev.value.split('\u3343');
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
};
