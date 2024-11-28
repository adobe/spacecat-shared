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
import { loadBundles } from '../utils.js';

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
  dataChunks.addFacet('patterns', (bundle) => urlToPatternMap[bundle.url]?.pattern);

  // counts metrics per each facet
  METRICS.forEach((metric) => dataChunks.addSeries(metric, series[metric]));

  const patternsChunks = dataChunks.facets.patterns.map((facet) => {
    const pattern = Object.values(urlToPatternMap).find((p) => p.pattern === facet.value);

    return {
      type: FACET_TYPE.GROUP,
      name: pattern.name,
      pattern: pattern.pattern,
      pageviews: facet.weight,
      metrics: calculateMetricsPercentile(facet.metrics),
    };
  });

  const urlsChunks = dataChunks.facets.urls.map((facet) => ({
    type: FACET_TYPE.URL,
    url: facet.value,
    pageviews: facet.weight,
    metrics: calculateMetricsPercentile(facet.metrics),
  }));

  const result = [...patternsChunks, ...urlsChunks]
    // filter out pages with no cwv data
    .filter((row) => METRICS.some((metric) => row.metrics[metric]))
    // sort desc by pageviews
    .sort((a, b) => b.metrics.pageviews - a.metrics.pageviews);

  return result;
}

export default {
  handler,
  checkpoints: METRICS.map((metric) => `cwv-${metric}`),
};
