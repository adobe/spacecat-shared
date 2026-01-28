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

import { DataChunks, facets } from '@adobe/rum-distiller';
import trafficAcquisition from './traffic-acquisition.js';
import { DELIMITER, generateKey, loadBundles } from '../utils.js';

const METRICS = ['formview', 'formengagement', 'formsubmit'];
const CHECKPOINTS = ['viewblock', 'click', 'fill', 'formsubmit', 'navigate', 'viewmedia', 'experiment'];
const KEYWORDS_TO_FILTER = ['search'];

function initializeResult(url) {
  return {
    url,
    formsubmit: {},
    formview: {},
    formengagement: {},
    pageview: {},
    forminternalnavigation: [],
  };
}

function filterEvents(bundles) {
  return bundles.map((bundle) => ({
    ...bundle,
    events: bundle.events.filter((event) => {
      if (!CHECKPOINTS.includes(event.checkpoint)) {
        return false;
      }

      if (event.checkpoint === 'navigate' || event.checkpoint === 'experiment') {
        return true;
      }

      const isFormRelatedEvent = ['fill', 'formsubmit'].includes(event.checkpoint)
        || /\bform\b|aemform\w*/i.test(event.source);

      return isFormRelatedEvent
        && !KEYWORDS_TO_FILTER.some(
          (keyword) => (event.source && event.source.toLowerCase().includes(keyword))
            || (event.target && event.target.toLowerCase().includes(keyword)),
        );
    }),
  }));
}

function isFormSource(source, eventSource) {
  const excludeSrc = ['form.', 'form#'];
  if (source === 'unknown') {
    return /\bform\b/.test(eventSource?.toLowerCase()) && !excludeSrc.some((exclude) => eventSource?.includes(exclude));
  } else {
    return eventSource?.includes(source);
  }
}

const metricFns = {
  formview: (source) => (bundle) => {
    const formView = bundle.events.find((e) => e.checkpoint === 'viewblock' && isFormSource(source, e.source));
    return formView ? bundle.weight : 0;
  },
  formengagement: (source) => (bundle) => {
    const formClick = bundle.events.find((e) => (e.checkpoint === 'click' || e.checkpoint === 'fill') && isFormSource(source, e.source));
    return formClick ? bundle.weight : 0;
  },
  formsubmit: (source) => (bundle) => {
    const formSubmit = bundle.events.find((e) => e.checkpoint === 'formsubmit' && isFormSource(source, e.source));
    return formSubmit ? bundle.weight : 0;
  },
};

function findByUrl(formVitals, url) {
  return Object.values(formVitals).find((item) => item.url === url);
}

function getAllURLWithExperiment(bundles) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);
  const { checkpoint } = facets;
  dataChunks.addFacet('checkpoint', checkpoint);
  return new Set(
    dataChunks.facets.checkpoint
      .filter((cp) => cp.value === 'experiment')
      .flatMap((_checkpoint) => _checkpoint.entries.map((_entry) => _entry.url)),
  );
}

function populateFormsInternalNavigation(bundles, formVitals) {
  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);
  dataChunks.filter = { checkpoint: ['navigate'] };
  dataChunks.filtered.forEach((bundle) => {
    const formInternalNav = bundle.events.find((e) => e.checkpoint === 'navigate');

    const formVital = findByUrl(formVitals, bundle.url);
    if (formInternalNav && formVital
        && !formVital.forminternalnavigation
          .some((e) => e.url === formInternalNav.source)) {
      const fv = findByUrl(formVitals, formInternalNav.source);
      formVital.forminternalnavigation.push({
        url: formInternalNav.source,
        ...(fv && { pageview: fv.pageview }),
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

            if (clickCheckpoint && clickCheckpoint.source) {
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

function isUnderExperiment(row, experimentUrls) {
  return experimentUrls.has(row.url);
}

function getParentPageVitalsGroupedByIFrame(bundles, dataChunks, iframeParentMap) {
  const iframeVitals = {};
  if (dataChunks.facets.urlUserAgents) {
    dataChunks.facets.urlUserAgents.reduce((acc, { value, weight }) => {
      const [url, userAgent] = value.split(DELIMITER);

      let iframeSrc = null;
      for (const iframeUrl of Object.keys(iframeParentMap)) {
        for (const parentUrl of iframeParentMap[iframeUrl]) {
          if (parentUrl === url) {
            iframeSrc = iframeUrl;
            break;
          }
        }
      }
      if (iframeSrc) {
        acc[url] = acc[url] || { url, pageview: {}, forminternalnavigation: [] };
        acc[url].pageview[userAgent] = acc[url].pageview[userAgent] || weight;
        acc[url].iframeSrc = iframeSrc;
      }
      return acc;
    }, iframeVitals);
  }
  const groupedByIframeSrc = {};
  const parentWebVitals = {};

  // select the parent page with the most views
  for (const [url, obj] of Object.entries(iframeVitals)) {
    const { iframeSrc } = obj;
    const totalViews = (obj.pageview.mobile || 0) + (obj.pageview.desktop || 0);
    if (!groupedByIframeSrc[iframeSrc] || totalViews > groupedByIframeSrc[iframeSrc].totalViews) {
      groupedByIframeSrc[iframeSrc] = { url, totalViews };
    }
  }

  for (const { url } of Object.values(groupedByIframeSrc)) {
    parentWebVitals[url] = iframeVitals[url];
  }

  populateFormsInternalNavigation(bundles, parentWebVitals);
  findFormCTAForInternalNavigation(bundles, Object.values(parentWebVitals));

  const iframeParentVitalsMap = {};
  for (const vitals of Object.values(parentWebVitals)) {
    iframeParentVitalsMap[vitals.iframeSrc] = vitals;
  }
  return iframeParentVitalsMap;
}

function handler(bundles) {
  // Filter out search related events

  const bundlesWithFilteredEvents = filterEvents(bundles);

  const dataChunks = new DataChunks();
  loadBundles(bundlesWithFilteredEvents, dataChunks);

  const formViewdataChunks = new DataChunks();
  loadBundles(bundlesWithFilteredEvents, formViewdataChunks);
  const formSourceMap = {};
  const iframeParentMap = {};
  const globalFormSourceSet = new Set();
  formViewdataChunks.filter = { checkpoint: ['viewblock', 'viewmedia'] };
  formViewdataChunks.filtered.forEach(({ url, events }) => {
    formSourceMap[url] = formSourceMap[url] || new Set();
    events.forEach(({ checkpoint, source, target }) => {
      if (checkpoint === 'viewblock' && source) {
        formSourceMap[url].add(source);
        globalFormSourceSet.add(source);
      }
      if (checkpoint === 'viewmedia' && target) {
        const regex = /aemform[\w.]*\.iframe[\w.]*/;
        if (regex.test(target)) {
          iframeParentMap[target] = iframeParentMap[target] || new Set();
          iframeParentMap[target].add(url);
        }
      }
    });
  });

  // remove duplicate urls with '#'
  const iframeParentMapWithoutDuplicates = Object.fromEntries(
    Object.entries(iframeParentMap).filter(([key]) => {
      if (key.endsWith('#')) {
        const baseUrl = key.slice(0, -1);
        return !Object.prototype.hasOwnProperty.call(iframeParentMap, baseUrl);
      }
      return true;
    }),
  );

  // traffic acquisition data per url - uncomment this when required
  const trafficByUrl = trafficAcquisition.handler(bundles);
  const trafficByUrlMap = Object.fromEntries(
    trafficByUrl.map(({ url, ...item }) => [url, item]),
  );
  const formVitals = {};

  globalFormSourceSet.forEach((source) => {
    // counts metrics per each group
    // Match form ID/class including CSS escape sequences (e.g., form#\35 57238494 or form#abc)
    const match = source.match(/form[#.]((?:\\[0-9a-fA-F]{1,6}\s?|\w|-)+)/);
    const formsource = match ? match[1] : 'unknown';
    // groups by url and user agent
    dataChunks.addFacet('urlUserAgents', (bundle) => {
      // eslint-disable-next-line no-nested-ternary
      const deviceType = bundle.userAgent.startsWith('desktop') ? 'desktop' : bundle.userAgent.startsWith('mobile') ? 'mobile' : 'other';
      return generateKey(bundle.url, deviceType);
    });

    METRICS.forEach((metric) => dataChunks.addSeries(metric, metricFns[metric](formsource)));
    // aggregates metrics per group (url and user agent)
    dataChunks.facets.urlUserAgents.reduce((acc, { value, metrics, weight }) => {
      const [url, userAgent] = value.split(DELIMITER);
      if (formSourceMap[url].has(source)) {
        const key = generateKey(url, source);
        acc[key] = acc[key] || initializeResult(url);
        acc[key].pageview[userAgent] = acc[key].pageview[userAgent] || weight;
        // Enable traffic acquisition for persistence by uncommenting this line
        acc[key].trafficacquisition = trafficByUrlMap[url];
        acc[key].formsource = source;
        // filter out user-agents with no form vitals
        METRICS.filter((metric) => metrics[metric].sum)
          .forEach((metric) => {
            acc[key][metric][userAgent] = metrics[metric].sum;
          });
      }
      return acc;
    }, formVitals);
  });

  const iframeParentVitalsMap = getParentPageVitalsGroupedByIFrame(
    bundles,
    dataChunks,
    iframeParentMapWithoutDuplicates,
  );

  const experimentUrls = getAllURLWithExperiment(bundlesWithFilteredEvents);

  // populate internal navigation data
  populateFormsInternalNavigation(bundles, formVitals);

  // filter out pages with no form vitals
  const filteredFormVitals = Object.values(formVitals).filter(
    (formVital) => containsFormVitals(formVital) && !isUnderExperiment(formVital, experimentUrls),
  );
  findFormCTAForInternalNavigation(bundles, filteredFormVitals);

  const updatedFormVitals = filteredFormVitals.map((formVital) => {
    const formVitalCopy = { ...formVital };
    const parentFormVital = iframeParentVitalsMap[formVital.url];
    if (parentFormVital) {
      const {
        url,
        pageview,
        forminternalnavigation,
        iframeSrc,
      } = parentFormVital;
      Object.assign(formVitalCopy, {
        url,
        pageview: { ...pageview },
        forminternalnavigation,

        iframeSrc,
      });
    }
    return formVitalCopy;
  });

  // keeping on top 5 by page views count internal navigation
  Object.values(updatedFormVitals).forEach((item) => {
    if (item.forminternalnavigation) {
      item.forminternalnavigation.sort((a, b) => {
        // eslint-disable-next-line max-len
        const sumA = a.pageview ? Object.values(a.pageview).reduce((sum, val) => sum + (val || 0), 0) : 0;
        // eslint-disable-next-line max-len
        const sumB = b.pageview ? Object.values(b.pageview).reduce((sum, val) => sum + (val || 0), 0) : 0;
        return sumB - sumA;
      });

      // eslint-disable-next-line no-param-reassign
      item.forminternalnavigation = item.forminternalnavigation.slice(0, 5);
    }
  });

  return [...updatedFormVitals];
}

export default {
  handler,
  checkpoints: CHECKPOINTS,
};
