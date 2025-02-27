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
import trafficAcquisition from './traffic-acquisition.js';
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
    forminternalnavigation: [],
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

function populateFormsInternalNavigation(bundles, formVitals) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);
  dataChunks.filter = { checkpoint: ['navigate'] };
  dataChunks.filtered.forEach((bundle) => {
    const forminternalnavigation = bundle.events.find((e) => e.checkpoint === 'navigate');
    if (forminternalnavigation && formVitals[bundle.url]
        && !formVitals[bundle.url].forminternalnavigation
          .some((e) => e.url === forminternalnavigation.source)) {
      formVitals[bundle.url].forminternalnavigation.push({
        url: forminternalnavigation.source,
        pageview: formVitals[forminternalnavigation.source]?.pageview || null,
      });
    }
  });
}

function findFormCTAForInternalNavigation(bundles, formVitals) {
  formVitals.forEach((item) => {
    const { url, forminternalnavigation } = item;
    if (forminternalnavigation && Array.isArray(forminternalnavigation)) {
      forminternalnavigation.forEach((nav) => {
        if (nav.url) {
          let totalClickOnPage = 0;
          const CTAs = new Map();
          const clickCheckpointBundles = bundles.filter((bundle) => bundle.url === nav.url && bundle.events.find((e) => e.checkpoint === 'click'));
          clickCheckpointBundles.forEach((bundle) => {
            totalClickOnPage += bundle.weight;
            const clickCheckpoint = bundle.events.find((e) => e.checkpoint === 'click' && e.target === url);

            if (clickCheckpoint) {
              const { source } = clickCheckpoint;
              // Retrieves the existing CTA object if it exists; otherwise,
              // initializes a new one with default values.
              const existingCTA = CTAs.get(source) || { source, clicks: 0 };
              existingCTA.clicks += bundle.weight;
              CTAs.set(source, existingCTA);
            }
          });

          // Convert CTAs Map to an array and store it in the nav object
          // eslint-disable-next-line no-param-reassign
          nav.CTAs = Array.from(CTAs.values());
          // eslint-disable-next-line no-param-reassign
          nav.totalClicksOnPage = totalClickOnPage;
        }
      });
    }
  });
}

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

  // traffic acquisition data per url
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const trafficByUrlMap = Object.fromEntries(
    trafficByUrl.map(({ url, ...item }) => [url, item]),
  );

  // aggregates metrics per group (url and user agent)
  const formVitals = dataChunks.facets.urlUserAgents.reduce((acc, { value, metrics, weight }) => {
    const [url, userAgent] = value.split(DELIMITER);

    acc[url] = acc[url] || initializeResult(url);
    acc[url].pageview[userAgent] = weight;
    acc[url].trafficacquisition = trafficByUrlMap[url];

    METRICS.filter((metric) => metrics[metric].sum) // filter out user-agents with no form vitals
      .forEach((metric) => {
        acc[url][metric][userAgent] = metrics[metric].sum;
      });

    return acc;
  }, {});

  // populate internal navigation data
  populateFormsInternalNavigation(bundles, formVitals);
  // filter out pages with no form vitals
  const filteredFormVitals = Object.values(formVitals).filter(containsFormVitals);
  findFormCTAForInternalNavigation(bundles, filteredFormVitals);
  return filteredFormVitals;
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click', 'navigate'],
};
