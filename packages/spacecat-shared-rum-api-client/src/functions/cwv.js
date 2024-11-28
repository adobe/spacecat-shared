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

import {
  DataChunks, series, facets,
} from '@adobe/rum-distiller';
import { generateKey, DELIMITER, loadBundles } from '../utils.js';

const METRICS = ['lcp', 'cls', 'inp', 'ttfb'];

const FACET_TYPE = {
  GROUP: 'group',
  URL: 'url',
};

const findMatchedPattern = (url, urlPatterns) => {
  for (const urlPattern of urlPatterns) {
    const regex = new RegExp(`^${urlPattern.pattern.replace(/\*/g, '.*')}$`);
    if (regex.test(url)) {
      return urlPattern;
    }
  }
  return null;
};

const mapUrlsToPatterns = (bundles, patterns) => {
  const urlToPatternMap = {};
  if (!patterns || patterns.length === 0) {
    return {};
  }

  for (const bundle of bundles) {
    const matchedPattern = findMatchedPattern(bundle.url, patterns);

    if (matchedPattern) {
      urlToPatternMap[bundle.url] = matchedPattern;
    }
  }
  return urlToPatternMap;
};

const calculateMetricsPercentile = (metrics) => ({
  lcp: metrics.lcp.percentile(75) || null,
  lcpCount: metrics.lcp.count || 0,
  cls: metrics.cls.percentile(75) || null,
  clsCount: metrics.cls.count || 0,
  inp: metrics.inp.percentile(75) || null,
  inpCount: metrics.inp.count || 0,
  ttfb: metrics.ttfb.percentile(75) || null,
  ttfbCount: metrics.ttfb.count || 0,
});

function handler(rawBundles, opts = []) {
  const bundles = rawBundles.map((bundle) => ({
    ...bundle,
    url: facets.url(bundle), // URL without ids, hashes, and other encoded data
  }));
  const urlToPatternMap = mapUrlsToPatterns(bundles, opts.groupedURLs);

  const dataChunks = new DataChunks();
  loadBundles(bundles, dataChunks);

  dataChunks.addFacet('urls', facets.url);

  // groups by pattern and device
  dataChunks.addFacet('patternsDevices', (bundle) => {
    if (urlToPatternMap[bundle.url]) {
      const device = bundle.userAgent.split(':')[0];
      return generateKey(urlToPatternMap[bundle.url]?.pattern, device);
    }
    return null;
  });
  dataChunks.addFacet('patterns', (bundle) => urlToPatternMap[bundle.url]?.pattern);

  // counts metrics per each facet
  METRICS.forEach((metric) => dataChunks.addSeries(metric, series[metric]));

  const patternsChunks = dataChunks.facets.patternsDevices.reduce((acc, facet) => {
    const [pattern, deviceType] = facet.value.split(DELIMITER);
    const patternData = Object.values(urlToPatternMap).find((p) => p.pattern === pattern);

    acc[pattern] = acc[pattern] || {
      type: FACET_TYPE.GROUP,
      name: patternData.name,
      pattern,
      pageviews: 0,
      metrics: [],
    };

    // Increment the total pageviews for pattern
    acc[pattern].pageviews += facet.weight;

    // Add metrics for the specific device type
    acc[pattern].metrics.push({
      deviceType,
      pageviews: facet.weight, // Pageviews for this device type
      ...calculateMetricsPercentile(facet.metrics),
    });

    return acc;
  }, {});

  const urlsChunks = dataChunks.facets.urls.map((facet) => ({
    type: FACET_TYPE.URL,
    url: facet.value,
    pageviews: facet.weight,
    metrics: calculateMetricsPercentile(facet.metrics),
  }))
    // filter out pages with no cwv data
    .filter((row) => METRICS.some((metric) => row.metrics[metric]));

  const result = [...Object.values(patternsChunks), ...urlsChunks]
    // sort desc by pageviews
    .sort((a, b) => b.metrics.pageviews - a.metrics.pageviews);

  return result;
}

export default {
  handler,
  checkpoints: METRICS.map((metric) => `cwv-${metric}`),
};
