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
      click: {},
      convert: {},
      formsubmit: {},
    };
    variants.push(variantObject);
  }
  return variantObject;
}

function handler(bundles) {
  const experimentInsights = {};
  for (const bundle of bundles) {
    const experimentEvent = bundle.events.find((e) => e.checkpoint === 'experiment');
    if (experimentEvent) {
      const { url, weight } = bundle;
      if (!experimentInsights[url]) {
        experimentInsights[url] = [];
      }
      const experimentName = experimentEvent.source;
      const variantName = experimentEvent.target;
      const experimentObject = getOrCreateExperimentObject(experimentInsights[url], experimentName);
      const variantObject = getOrCreateVariantObject(experimentObject.variants, variantName);
      variantObject.views += weight;

      const metrics = {};
      for (const checkpoint of METRIC_CHECKPOINTS) {
        metrics[checkpoint] = {};
      }
      for (const event of bundle.events) {
        if (METRIC_CHECKPOINTS.includes(event.checkpoint)) {
          const { source, checkpoint } = event;
          if (!metrics[checkpoint][source]) {
            metrics[checkpoint][source] = weight;
          } else {
            metrics[checkpoint][source] += weight;
          }
        }
      }
      // combine metrics and variantObject, considering the interaction events
      // only once during the session
      for (const checkpoint of METRIC_CHECKPOINTS) {
        // eslint-disable-next-line no-restricted-syntax
        for (const source in metrics[checkpoint]) {
          if (!variantObject[checkpoint][source]) {
            variantObject[checkpoint][source] = weight;
          } else {
            variantObject[checkpoint][source] += weight;
          }
        }
      }
      // add each metric to the variantObject's * count by weight
      for (const checkpoint of Object.keys(metrics)) {
        if (Object.keys(metrics[checkpoint]).length > 0) {
          if (!variantObject[checkpoint]['*']) {
            variantObject[checkpoint]['*'] = weight;
          } else {
            variantObject[checkpoint]['*'] += weight;
          }
        }
      }
      // add global interactionsCount if there's any interaction
      const hasInteraction = Object.values(metrics).some((m) => Object.keys(m).length > 0);
      if (hasInteraction) {
        if (!variantObject.interactionsCount) {
          variantObject.interactionsCount = weight;
        } else {
          variantObject.interactionsCount += weight;
        }
      }
    }
  }
  return experimentInsights;
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
