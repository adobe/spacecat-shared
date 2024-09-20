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

function getMax(metric) {
  return (bundle) => {
    const values = bundle.events.filter((event) => event.checkpoint === `cwv-${metric}`)
      .map((event) => event.value);
    return values.length > 0 ? Math.max(values) : undefined;
  };
}

function handler(bundles) {
  const dataChunks = new DataChunks();

  dataChunks.loadBundles(bundles);

  dataChunks.addFacet('urls', (bundle) => bundle.url);

  dataChunks.addSeries('lcp', getMax('lcp'));
  dataChunks.addSeries('cls', getMax('cls'));
  dataChunks.addSeries('inp', getMax('inp'));
  dataChunks.addSeries('ttfb', getMax('ttfb'));

  return dataChunks.facets.urls.map((urlFacet) => ({
    url: urlFacet.value,
    pageviews: urlFacet.weight,
    lcp: urlFacet.metrics.lcp.percentile(75) || null,
    lcpCount: urlFacet.metrics.lcp.count,
    cls: urlFacet.metrics.cls.percentile(75) || null,
    clsCount: urlFacet.metrics.cls.count,
    inp: urlFacet.metrics.inp.percentile(75) || null,
    inpCount: urlFacet.metrics.inp.count,
    ttfb: urlFacet.metrics.ttfb.percentile(75) || null,
    ttfbCount: urlFacet.metrics.ttfb.count,
  }))
    .filter((row) => row.lcp || row.cls || row.inp || row.ttfb) // filter out pages with no cwv data
    .sort((a, b) => b.pageviews - a.pageviews); // sort desc by pageviews
}

export default {
  handler,
  checkpoints: ['cwv-lcp', 'cwv-cls', 'cwv-inp', 'cwv-ttfb'],
};
