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

  dataChunks.addFacet('experiments', (bundle) => [...new Set(bundle.events.filter((e) => e.checkpoint === 'experiment')
    .flatMap((e) => bundle.events.filter((c) => ['click', 'formsubmit', 'convert'].includes(c.checkpoint) && c.source).flatMap((c) => [`${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.checkpoint}\u3343${c.source}`, `${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.checkpoint}\u3343*`]).concat([`${bundle.url}\u3343${e.source}\u3343${e.target}`, `${bundle.url}\u3343${e.source}`])))]);

  dataChunks.addSeries('experimenttime', (bundle) => new Date(bundle.time).getTime());

  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('interaction', (bundle) => (bundle.events.find((e) => e.checkpoint === 'click' || e.checkpoint === 'formsubmit' || e.checkpoint === 'convert') ? bundle.weight : undefined));

  const { experiments } = dataChunks.facets;

  const result = {};
  experiments.forEach((uev) => {
    const [url, experiment, variant, checkpoint, source] = uev.value.split('\u3343');
    if (!result[url]) result[url] = [];
    let eIdx = result[url].findIndex((e) => e.experiment === experiment);
    if (eIdx === -1) {
      result[url].push({
        experiment,
        variants: [],
      });
      eIdx = result[url].length - 1;
    }
    if (variant) {
      let vIdx = result[url][eIdx].variants.findIndex((v) => v.name === variant);
      if (vIdx === -1) {
        result[url][eIdx].variants.push({
          name: variant,
          click: {},
          formsubmit: {},
          convert: {},
        });
        vIdx = result[url][eIdx].variants.length - 1;
      }
      if (checkpoint && source) {
        result[url][eIdx].variants[vIdx][checkpoint][source] = {
          value: uev.metrics.views.sum,
          samples: uev.metrics.views.count,
        };
      } else {
        result[url][eIdx].variants[vIdx].interactionsCount = uev.metrics.interaction.sum;
        result[url][eIdx].variants[vIdx].samples = uev.metrics.views.count;
        result[url][eIdx].variants[vIdx].views = uev.metrics.views.sum;
      }
    } else {
      result[url][eIdx].inferredStartDate = new Date(uev.metrics.experimenttime.min)
        .toISOString();
      result[url][eIdx].inferredEndDate = new Date(uev.metrics.experimenttime.max)
        .toISOString();
    }
  });

  return result;
}

export default {
  handler,
};
