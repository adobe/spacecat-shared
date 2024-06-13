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

const EXPERIMENT_CHECKPOINT = ['experiment'];
const METRIC_CHECKPOINTS = ['click', 'convert', 'formsubmit'];
const CHECKPOINTS = [...EXPERIMENT_CHECKPOINT, ...METRIC_CHECKPOINTS];

function toClassName(name) {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : '';
}

function getOrCreateExperimentObject(urlInsights, experimentName) {
  let experimentObject = urlInsights.find((e) => e.experiment === toClassName(experimentName));
  if (!experimentObject) {
    experimentObject = {
      experiment: toClassName(experimentName),
      variants: [],
    };
    urlInsights.push(experimentObject);
  }
  return experimentObject;
}

function getOrCreateVariantObject(variants, variantName) {
  let variantObject = variants.find((v) => v.name === variantName);
  if (!variantObject) {
    variantObject = {
      name: variantName,
      views: 0,
      clicks: {},
      conversions: {},
    };
    variants.push(variantObject);
  }
  return variantObject;
}

function convertToExperimentsSchema(experimentInsights) {
  const experiments = [];
  for (const url of Object.keys(experimentInsights)) {
    const urlInsights = experimentInsights[url];
    for (const experiment of urlInsights) {
      const id = experiment.experiment;
      const variants = [];
      for (const variant of experiment.variants) {
        const variantName = variant.name;
        const { views } = variant;
        const metrics = [];
        for (const metric of METRIC_CHECKPOINTS) {
          for (const selector of Object.keys(variant[metric])) {
            metrics.push({
              type: metric,
              value: variant[metric][selector],
              selector,
            });
          }
        }
        variants.push({
          name: variantName,
          views,
          metrics,
        });
      }
      experiments.push({
        id,
        url,
        variants,
      });
    }
  }
  return experiments;
}

function handler(bundles) {
  const experimentInsights = {};
  for (const bundle of bundles) {
    const { url, weight } = bundle;
    if (!experimentInsights[url]) {
      experimentInsights[url] = [];
    }
    const experimentEvent = bundle.events.find((e) => e.checkpoint === 'experiment');
    if (experimentEvent) {
      const experimentName = experimentEvent.source;
      const variantName = experimentEvent.target;
      const experimentObject = getOrCreateExperimentObject(experimentInsights[url], experimentName);
      const variantObject = getOrCreateVariantObject(experimentObject.variants, variantName);
      variantObject.views += weight;

      for (const event of bundle.events) {
        if (METRIC_CHECKPOINTS.includes(event.checkpoint)) {
          const { source, checkpoint } = event;
          if (!variantObject[checkpoint][source]) {
            variantObject[checkpoint][source] = weight;
          } else {
            variantObject[checkpoint][source] += weight;
          }
        }
      }
    }
  }
  return convertToExperimentsSchema(experimentInsights);
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
