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

const FORM_SOURCE = ['.form', '.marketo', '.marketo-form'];
const METRICS = ['formview', 'formengagement', 'formsubmit', 'formbuttonclick'];

function initializeResult(url) {
  return {
    url,
    formsubmit: {},
    formview: {},
    formengagement: {},
    formbuttonclick: {},
    pageview: {},
  };
}

const metricFns = {
  formview: (bundle) => {
    const formView = bundle.events.find((e) => e.checkpoint === 'viewblock' && FORM_SOURCE.includes(e.source));
    return formView ? bundle.weight : 0;
  },
  formengagement: (bundle) => {
    const formClick = bundle.events.find((e) => e.checkpoint === 'click' && e.source && /\bform\b/.test(e.source.toLowerCase()));
    return formClick ? bundle.weight : 0;
  },
  formsubmit: (bundle) => {
    const formSubmit = bundle.events.find((e) => e.checkpoint === 'formsubmit');
    return formSubmit ? bundle.weight : 0;
  },
  formbuttonclick: (bundle) => {
    const formButtonClick = bundle.events.find((e) => e.checkpoint === 'click' && e.source
        && /\bform\b/.test(e.source.toLowerCase())
        && /\bbutton\b/.test(e.source.toLowerCase()));
    return formButtonClick ? bundle.weight : 0;
  },
};

function containsFormVitals(row) {
  return METRICS.some((metric) => Object.keys(row[metric]).length > 0);
}

function handler(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  // groups by url and user agent
  dataChunks.addFacet('urlUserAgents', (bundle) => generateKey(bundle.url, bundle.userAgent));

  // counts metrics per each group
  METRICS.forEach((metric) => dataChunks.addSeries(metric, metricFns[metric]));

  // aggregates metrics per group (url and user agent)
  const formVitals = dataChunks.facets.urlUserAgents.reduce((acc, { value, metrics, weight }) => {
    const [url, userAgent] = value.split(DELIMITER);

    acc[url] = acc[url] || initializeResult(url);
    acc[url].pageview[userAgent] = weight;

    METRICS.filter((metric) => metrics[metric].sum) // filter out user-agents with no form vitals
      .forEach((metric) => {
        acc[url][metric][userAgent] = metrics[metric].sum;
      });

    return acc;
  }, {});

  return Object.values(formVitals)
    .filter(containsFormVitals); // filter out pages with no form vitals
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click'],
};
