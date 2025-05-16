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
/* eslint-env mocha */

import { expect } from 'chai';
import trafficMetrics from '../src/functions/traffic-metrics.js';
import bundlesWithTraffic from './fixtures/bundles.json' with { type: 'json' };
import expectedTraficMetricResults from './fixtures/exptected-traffic-metrics-result.json' with { type: 'json' };

const pageTypesString = {
  'home | landing': '^/$',
  'product | pdp | detail | software-product': '^/(products|product|solutions)/\\w+',
  'category | plp | content-hub | industry-listing': '^/(categories|collections|topics|industry|industries)/\\w+',
  'search | result | directory-search': '^/search(\\?.*)?$',
  'cart | basket | subscription-cart': '^/(cart|basket|subscriptions?)$',
  'checkout | payment | subscribe': '^/(checkout|pay|subscribe)$',
  'account | profile | user-dashboard | my-portal': '^/(account|profile|dashboard|portal)(/.*)?$',
  'blog | article | news | insights': '^/(blog|news|articles?|insights)(/.*)?$',
  'docs | documentation | help | support': '^/(docs|documentation|help|support)(/.*)?$',
  '404 | not-found | error': '^/(404|not-found|error)$',
};

const pageTypesRegEx = {
  'home | landing': /^\/$/,
  'product | pdp | detail | software-product': /^\/(products|product|solutions)\/\w+/,
  'category | plp | content-hub | industry-listing': /^\/(categories|collections|topics|industry|industries)\/\w+/,
  'search | result | directory-search': /^\/search(\?.*)?$/,
  'cart | basket | subscription-cart': /^\/(cart|basket|subscriptions?)$/,
  'checkout | payment | subscribe': /^\/(checkout|pay|subscribe)$/,
  'account | profile | user-dashboard | my-portal': /^\/(account|profile|dashboard|portal)(\/.*)?$/,
  'blog | article | news | insights': /^\/(blog|news|articles?|insights)(\/.*)?$/,
  'docs | documentation | help | support': /^\/(docs|documentation|help|support)(\/.*)?$/,
  '404 | not-found | error': /^\/(404|not-found|error)$/,
  'other | Other Pages': /.*/, // This will match any URL that didn't match previous patterns
};

const options = {
  pageTypes: pageTypesRegEx,
};

const stringRegexOptions = {
  pageTypes: pageTypesString,
};

const expectedGroupings = [
  'url',
  'urlTrafficSource',
  'urlDeviceType',
  'urlTrafficSourceDeviceType',
  'pageType',
  'pageTypeTrafficSource',
  'pageTypeDeviceType',
  'pageTypeTrafficSourceDeviceType',
  'deviceType',
  'deviceTypeTrafficSource',
  'trafficSource',
];

const expectedMetrics = [
  'ctr',
  'clickedSessions',
  'totalSessions',
  'sessionsWithEnter',
  'clicksOverViews',
  'bounceRate',
  'totalNumClicks',
  'avgClicksPerSession',
];

describe('Traffic-categories metrics', () => {
  it('Provies traffic-categorization metrics', async () => {
    const traficMetricResults = trafficMetrics.handler(bundlesWithTraffic.rumBundles, options);
    console.log(JSON.stringify(traficMetricResults));
    expect(traficMetricResults).to.deep.equal(expectedTraficMetricResults);
  });

  it('Provides populated metrics for all groupings', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles, options);
    expectedGroupings.forEach((eGroup) => {
      const entry = result.find((item) => item.key === eGroup);
      expect(entry, `Missing grouping: ${eGroup}`).to.exist;
      expect(entry.value).to.not.be.oneOf([null, undefined, '', NaN, []]);
    });
  });

  it('Provides expected metrics per group', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles, options);
    expectedGroupings.forEach((group) => {
      const dim = result.find((item) => item.key === group);
      expectedMetrics.forEach((metric) => {
        const m = dim.value[0][metric];
        expect(m, `Missing metric: ${metric}`).to.exist;
        expect(typeof m === 'number' && !Number.isNaN(m)).to.be.true;
      });
    });
  });

  it('Provides metrics grouping per pageType', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles, options);
    const pageType = result.find((metric) => metric.key === 'pageType');
    expect(pageType.value).lengthOf(1);
  });

  it('Provides metrics if options are string regex', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles, stringRegexOptions);
    const pageType = result.find((metric) => metric.key === 'pageType');
    expect(pageType.value).lengthOf(1);
  });

  it('Provides uncategorized if pageOptions not defined', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles);
    const pageType = result.find((metric) => metric.key === 'pageType');
    expect(pageType.value).lengthOf(1);
    expect(pageType.value[0].type).to.eql('uncategorized');
  });

  it('Provides uncategorized if pageOptions empty', async () => {
    const result = trafficMetrics.handler(bundlesWithTraffic.rumBundles, { pageTypes: [] });
    const pageType = result.find((metric) => metric.key === 'pageType');
    expect(pageType.value).lengthOf(1);
    expect(pageType.value[0].type).to.eql('uncategorized');
  });
});
