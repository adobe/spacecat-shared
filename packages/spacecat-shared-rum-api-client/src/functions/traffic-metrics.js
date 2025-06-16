/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { DELIMITER, generateKey, loadBundles } from '../utils.js';
import { classifyTraffic } from '../common/traffic.js';
import { getPageType, isConsentClick } from '../common/page.js';

function getTrafficSource(bundle) {
  return classifyTraffic(bundle).type;
}

function getDeviceType(bundle) {
  return bundle.userAgent.split(':')?.[0];
}

function addPageTypeFacet(dataChunks, pageTypes) {
  dataChunks.addFacet('pageType', (bundle) => getPageType(bundle, pageTypes));
}

function addPageTypeDeviceTypeFacet(dataChunks, pageTypes) {
  dataChunks.addFacet('pageTypeDeviceTypes', (bundle) => {
    const deviceType = getDeviceType(bundle);
    const pageType = getPageType(bundle, pageTypes);
    return generateKey(pageType, deviceType);
  });
}

function addPageTypeTrafficSourceDeviceTypes(dataChunks, pageTypes) {
  dataChunks.addFacet('pageTrafficDeviceTypes', (bundle) => {
    const deviceType = getDeviceType(bundle);
    const pageType = getPageType(bundle, pageTypes);
    return generateKey(pageType, getTrafficSource(bundle), deviceType);
  });
}

function addPageTypeTrafficSourceFacet(dataChunks, pageTypes) {
  dataChunks.addFacet('pageTypeTrafficSources', (bundle) => {
    const pageType = getPageType(bundle, pageTypes);
    return generateKey(pageType, getTrafficSource(bundle));
  });
}

function handler(bundles, options = { pageTypes: null }) {
  const dataChunks = new DataChunks();
  const { pageTypes: pageTypeOpt } = options;

  loadBundles(bundles, dataChunks);

  const metricFilter = (metrics) => {
    const { ctr, enters, sumOfAllClicks } = metrics;
    return {
      ctr: ctr.sum / ctr.weight,
      clickedSessions: ctr.sum,
      totalSessions: ctr.weight,
      sessionsWithEnter: enters.sum,
      clicksOverViews: ctr.weight ? ctr.sum / ctr.weight : 0,
      bounceRate: ctr.weight ? (1 - (ctr.sum / ctr.weight)) : 0,
      totalNumClicks: sumOfAllClicks.sum,
      avgClicksPerSession: ctr.sum ? sumOfAllClicks.sum / ctr.sum : 0,
    };
  };

  dataChunks.addFacet('urls', (bundle) => bundle.url);

  dataChunks.addFacet('trafficSources', (bundle) => getTrafficSource(bundle));

  dataChunks.addFacet('urlTrafficSources', (bundle) => generateKey(bundle.url, getTrafficSource(bundle)));

  dataChunks.addFacet('urlDeviceTypes', (bundle) => generateKey(bundle.url, getDeviceType(bundle)));

  dataChunks.addFacet('deviceTypes', (bundle) => getDeviceType(bundle));

  dataChunks.addFacet('urlTrafficSourceDeviceTypes', (bundle) => generateKey(bundle.url, getTrafficSource(bundle), getDeviceType(bundle)));

  dataChunks.addFacet('deviceTypeTrafficSources', (bundle) => generateKey(getDeviceType(bundle), getTrafficSource(bundle)));

  addPageTypeFacet(dataChunks, pageTypeOpt);

  addPageTypeTrafficSourceFacet(dataChunks, pageTypeOpt);

  addPageTypeDeviceTypeFacet(dataChunks, pageTypeOpt);

  addPageTypeTrafficSourceDeviceTypes(dataChunks, pageTypeOpt);

  dataChunks.addSeries('ctr', (bundle) => {
    const isClicked = bundle.events.some((e) => e.checkpoint === 'click');
    return isClicked ? bundle.weight : 0;
  });

  dataChunks.addSeries('sumOfAllClicks', (bundle) => {
    const nonConsentClicks = bundle.events
      .filter((e) => e.checkpoint === 'click' && !isConsentClick(e.source))
      .map(() => bundle.weight)
      .reduce((sum, weight) => sum + weight, 0);

    return nonConsentClicks;
  });

  dataChunks.addSeries('enters', (bundle) => {
    const containsEnter = bundle.events.some((e) => e.checkpoint === 'enter');
    return containsEnter ? bundle.weight : 0;
  });

  const urls = dataChunks.facets.urls.map((facet) => {
    const url = facet.value;
    return {
      ...metricFilter(facet.metrics),
      url,
    };
  });

  const pageType = dataChunks.facets.pageType.map((facet) => {
    const type = facet.value;
    return {
      ...metricFilter(facet.metrics),
      type,
    };
  });

  const deviceTypes = dataChunks.facets.deviceTypes.map((facet) => {
    const deviceType = facet.value;
    return {
      ...metricFilter(facet.metrics),
      deviceType,
    };
  });

  const urlDeviceTypes = dataChunks.facets.urlDeviceTypes.map((facet) => {
    const [url, deviceType] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      url,
      deviceType,
    };
  });

  const trafficSources = dataChunks.facets.trafficSources.map((facet) => {
    const source = facet.value;
    return {
      ...metricFilter(facet.metrics),
      source,
    };
  });

  const urlTrafficSources = dataChunks.facets.urlTrafficSources.map((facet) => {
    const [url, source] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      url,
      source,
    };
  });

  const urlTrafficSourceDeviceTypes = dataChunks.facets.urlTrafficSourceDeviceTypes.map((facet) => {
    const [url, source, deviceType] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      url,
      source,
      deviceType,
    };
  });

  const pageTypeTrafficSources = dataChunks.facets.pageTypeTrafficSources.map((facet) => {
    const [type, source] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      type,
      source,
    };
  });

  const pageTypeDeviceTypes = dataChunks.facets.pageTypeDeviceTypes.map((facet) => {
    const [type, deviceType] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      type,
      deviceType,
    };
  });

  const deviceTypeTrafficSources = dataChunks.facets.deviceTypeTrafficSources.map((facet) => {
    const [deviceType, source] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      deviceType,
      source,
    };
  });

  const pageTrafficDeviceTypes = dataChunks.facets.pageTrafficDeviceTypes.map((facet) => {
    const [type, source, deviceType] = facet.value.split(DELIMITER);
    return {
      ...metricFilter(facet.metrics),
      type,
      source,
      deviceType,
    };
  });

  const metrics = {
    url: urls,
    urlTrafficSource: urlTrafficSources,
    urlDeviceType: urlDeviceTypes,
    urlTrafficSourceDeviceType: urlTrafficSourceDeviceTypes,
    pageType,
    pageTypeTrafficSource: pageTypeTrafficSources,
    pageTypeDeviceType: pageTypeDeviceTypes,
    pageTypeTrafficSourceDeviceType: pageTrafficDeviceTypes,
    deviceType: deviceTypes,
    deviceTypeTrafficSource: deviceTypeTrafficSources,
    trafficSource: trafficSources,
  };

  return Object.entries(metrics)
    .map(([key, value]) => ({
      key,
      value,
    }));
}

export default {
  handler,
};
