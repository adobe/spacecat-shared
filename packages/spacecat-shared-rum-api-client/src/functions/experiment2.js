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
import { pageviewsByUrl } from '../common/aggregateFns.js';

const EXPERIMENT_CHECKPOINT = ['experiment'];
const METRIC_CHECKPOINTS = ['click', 'convert', 'formsubmit'];
const CHECKPOINTS = [...EXPERIMENT_CHECKPOINT, ...METRIC_CHECKPOINTS];
const DELIMITER = '\u3343';

function createOrGetExperiment(acc, url, experiment) {
  if (!acc[url]) acc[url] = [];
  const experimentIndex = acc[url].findIndex((item) => item.experiment === experiment);
  if (experimentIndex === -1) {
    acc[url].push({
      experiment,
      variants: [],
    });
    return acc[url][acc[url].length - 1];
  }
  return acc[url][experimentIndex];
}

function collect(bundles, checkpoint) {
  return bundles.reduce((acc, cur) => {
    const sources = [...new Set(cur.events.filter((event) => event.checkpoint === checkpoint)
      .map((event) => event.source))];
    sources.forEach((source) => {
      if (!acc[source]) acc[source] = { value: 0, samples: 0 };
      acc[source].value += cur.weight;
      acc[source].samples += 1;
    });
    if (sources.length > 0) {
      if (!acc['*']) acc['*'] = { value: 0, samples: 0 };
      acc['*'].value += cur.weight;
      acc['*'].samples += 1;
    }
    return acc;
  }, {});
}

function count(bundles, ...checkpoints) {
  return bundles.filter((b) => b.events.some((e) => checkpoints.includes(e.checkpoint)))
    .reduce((acc, cur) => {
      acc += cur.weight;
      return acc;
    }, 0);
}

function handler(chunks) {
  const dataChunks = new DataChunks();

  dataChunks.load(chunks);

  const groupedChunks = dataChunks.group((bundle) => bundle.events.filter((event) => event.checkpoint === 'experiment')
    .map((e) => `${bundle.url}${DELIMITER}${e.source}${DELIMITER}${e.target}`));

  return Object.entries(groupedChunks)
    .reduce((acc, [key, bundles]) => {
      const [url, experimentName, variant] = key.split(DELIMITER);
      const experiment = createOrGetExperiment(acc, url, experimentName);
      experiment.variants.push({
        name: variant,
        views: pageviewsByUrl(bundles)[url],
        samples: bundles.length,
        click: collect(bundles, 'click'),
        convert: collect(bundles, 'convert'),
        formsubmit: collect(bundles, 'formsubmit'),
        interactionsCount: count(bundles, 'click', 'convert', 'formsubmit'),
      });

      const sorted = [
        ...(experiment.inferredStartDate ? [experiment.inferredStartDate] : []),
        ...(experiment.inferredEndDate ? [experiment.inferredEndDate] : []),
        ...bundles.map((b) => b.time)].sort();
      experiment.inferredStartDate = sorted.shift();
      experiment.inferredEndDate = sorted.pop();
      return acc;
    }, {});
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
