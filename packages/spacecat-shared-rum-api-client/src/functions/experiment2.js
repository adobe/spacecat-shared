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

const EXPERIMENT_CHECKPOINT = ['experiment'];
const METRIC_CHECKPOINTS = ['click', 'convert', 'formsubmit'];
const CHECKPOINTS = [...EXPERIMENT_CHECKPOINT, ...METRIC_CHECKPOINTS];

const sourceOf = (c) => (b) => b.events.filter((e) => e.checkpoint === c).map((e) => e.source);
const targetOf = (c) => (b) => b.events.filter((e) => e.checkpoint === c).map((e) => e.target);

function handler(bundles) {
  const dataChunks = new DataChunks();

  dataChunks.load(bundles);

  dataChunks.addFacet('urls', (bundle) => bundle.url);
  dataChunks.addFacet('experiments', sourceOf('experiment'));
  dataChunks.addFacet('variants', targetOf('experiment'));
  dataChunks.addFacet('clicks', sourceOf('click'));
  dataChunks.addFacet('urlExperimentVariant', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .map((e) => `${bundle.url}\u3343${e.source}\u3343${e.target}`));

  const {
    urls, experiments, variants, clicks, urlExperimentVariant,
  } = dataChunks.facets;

  const result = {};

  urls.forEach((urlFacet) => {
    result[urlFacet.value] = [];

    dataChunks.facets.experiments.forEach((experimentFacet) => {
      const experiment = {
        experiment: experimentFacet.value,
        variants: [],
      };

      let found = false;

      dataChunks.facets.variants.forEach((variantFacet) => {
        const filtered = dataChunks.filterBundles(urlFacet.entries, {
          urlExperimentVariant: [`${urlFacet.value}\u3343${experimentFacet.value}\u3343${variantFacet.value}`],
        });

        if (filtered.length > 0) found = true;

        const click = filtered.reduce((acc, cur) => {
          [...new Set(cur.events.filter((e) => e.checkpoint === 'click')
            .map((e) => e.source))].forEach((source) => {
            if (!acc[source]) acc[source] = 0;
            acc[source] += cur.weight;
          });
          return acc;
        }, {});

        experiment.variants.push({
          name: variantFacet.value,
          click,
          views: filtered.reduce((acc, cur) => {
            acc += cur.weight;
            return acc;
          }, 0),
        });

        console.log();
      });

      if (found) result[urlFacet.value].push(experiment);
    });
  });

  console.log();
  return result;
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
