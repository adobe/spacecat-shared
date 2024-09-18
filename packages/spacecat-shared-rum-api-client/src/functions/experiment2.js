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

const values = (source) => [...new Set(source.values.flatMap((v) => v))];
const totals = (c) => (bundle) => {
  const result = [...new Set(bundle.events.filter((e) => e.checkpoint === c
    && e.source).map((e) => e.source))];
  return result.length > 0 ? result : undefined;
};
const weight = (c) => (bundle) => (bundle.events.find((e) => e.checkpoint === c)
  ? bundle.weight : undefined);

function handler(bundles) {
  const dataChunks = new DataChunks();

  dataChunks.load(bundles);

  dataChunks.addFacet('urlExperiment', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .map((e) => `${bundle.url}\u3343${e.source}`));
  dataChunks.addFacet('urlExperimentVariant', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .map((e) => `${bundle.url}\u3343${e.source}\u3343${e.target}`));
  dataChunks.addFacet('urlExperimentVariantClick', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .flatMap((e) => bundle.events.filter((c) => c.checkpoint === 'click' && c.source).map((c) => `${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.source}`)));
  dataChunks.addFacet('urlExperimentVariantForm', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .flatMap((e) => bundle.events.filter((c) => c.checkpoint === 'formsubmit' && c.source).map((c) => `${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.source}`)));
  dataChunks.addFacet('urlExperimentVariantConvert', (bundle) => bundle.events.filter((e) => e.checkpoint === 'experiment')
    .flatMap((e) => bundle.events.filter((c) => c.checkpoint === 'convert' && c.source).map((c) => `${bundle.url}\u3343${e.source}\u3343${e.target}\u3343${c.source}`)));

  dataChunks.addSeries('views', (bundle) => bundle.weight);
  dataChunks.addSeries('clickviews', weight('click'));
  dataChunks.addSeries('formviews', weight('formsubmit'));
  dataChunks.addSeries('convertviews', weight('convert'));
  dataChunks.addSeries('clicks', totals('click'));
  dataChunks.addSeries('formsubmit', totals('formsubmit'));
  dataChunks.addSeries('convert', totals('convert'));
  dataChunks.addSeries('experimenttime', (bundle) => new Date(bundle.time).getTime());
  dataChunks.addSeries('interaction', (bundle) => (bundle.events.find((e) => 'click' || e.checkpoint === 'formsubmit' || e.checkpoint === 'convert') ? bundle.weight : undefined));

  const {
    urlExperimentVariant,
  } = dataChunks.facets;

  const result = {};

  urlExperimentVariant.forEach((uev) => {
    const [url, experiment, variant] = uev.value.split('\u3343');
    if (!result[url]) result[url] = [];
    let experimentIndex = result[url].findIndex((e) => e.experiment === experiment);
    if (experimentIndex === -1) {
      dataChunks.filter = {
        urlExperiment: [`${url}\u3343${experiment}`],
      };
      result[url].push({
        experiment,
        variants: [],
        inferredStartDate: new Date(dataChunks.totals.experimenttime.min).toISOString(),
        inferredEndDate: new Date(dataChunks.totals.experimenttime.max).toISOString(),
      });
      experimentIndex = result[url].length - 1;
    }

    dataChunks.filter = {
      urlExperimentVariant: [uev.value],
    };

    const views = dataChunks.totals.views.sum;
    const samples = dataChunks.totals.views.count;
    const interactionsCount = dataChunks.totals.interaction.sum;
    const clicktotals = dataChunks.totals.clicks;
    const formtotals = dataChunks.totals.formsubmit;
    const converttotals = dataChunks.totals.convert;

    const clicks = dataChunks.totals.clickviews.count > 0 ? {
      '*': { value: dataChunks.totals.clickviews.sum, samples: dataChunks.totals.clickviews.count },
    } : {};

    const formsubmit = dataChunks.totals.formviews.count > 0 ? {
      '*': { value: dataChunks.totals.formviews.sum, samples: dataChunks.totals.formviews.count },
    } : {};

    const convert = dataChunks.totals.convertviews.count > 0 ? {
      '*': { value: dataChunks.totals.convertviews.sum, samples: dataChunks.totals.convertviews.count },
    } : {};

    values(clicktotals).forEach((click) => {
      dataChunks.filter = {
        urlExperimentVariantClick: [`${uev.value}\u3343${click}`],
      };
      clicks[click] = {
        value: dataChunks.totals.views.sum,
        samples: dataChunks.totals.views.count,
      };
    });

    values(formtotals).forEach((click) => {
      dataChunks.filter = {
        urlExperimentVariantForm: [`${uev.value}\u3343${click}`],
      };
      formsubmit[click] = {
        value: dataChunks.totals.views.sum,
        samples: dataChunks.totals.views.count,
      };
    });

    values(converttotals).forEach((click) => {
      dataChunks.filter = {
        urlExperimentVariantConvert: [`${uev.value}\u3343${click}`],
      };
      convert[click] = {
        value: dataChunks.totals.views.sum,
        samples: dataChunks.totals.views.count,
      };
    });

    result[url][experimentIndex].variants.push({
      name: variant,
      views,
      samples,
      interactionsCount,
      clicks,
      formsubmit,
      convert,
    });
  });

  return result;
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
