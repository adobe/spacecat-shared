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
import bundlesWithTrafficSource from './fixtures/bundles-with-traffic-source.json' with { type: 'json' };
import { classifyTraffic } from '../src/common/traffic.js';

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
  'pageViews',
  'sessionsWithEnter',
  'clicksOverViews',
  'bounceRate',
  'totalNumClicks',
  'avgClicksPerSession',
];

describe('Traffic metrics', () => {
  it('Provies traffic-categorization metrics', async () => {
    const traficMetricResults = trafficMetrics.handler(bundlesWithTraffic.rumBundles, options);
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

  it('Only returns metrics for paid traffic', async () => {
    const result = trafficMetrics.handler(bundlesWithTrafficSource.rumBundles, { ...options, trafficType: 'paid' });
    const getSourceType = (bundle) => classifyTraffic(bundle).type;

    // 1. Group all bundles by (url, type)
    const allTuples = new Set(
      bundlesWithTrafficSource.rumBundles.map((b) => `${b.url}|${getSourceType(b)}`),
    );
    const paidTuples = new Set(
      Array.from(allTuples).filter((tuple) => tuple.endsWith('|paid')),
    );
    const nonPaidTuples = new Set(
      Array.from(allTuples).filter((tuple) => !tuple.endsWith('|paid')),
    );

    // 2. Collect all (url, source) tuples returned in the result
    const resultTuples = new Set();
    result.forEach((group) => {
      group.value.forEach((segment) => {
        if ('url' in segment && 'source' in segment) {
          const type = segment.source.split(':')[0];
          resultTuples.add(`${segment.url}|${type}`);
        }
        if (Array.isArray(segment.urls) && segment.source) {
          const type = segment.source.split(':')[0];
          segment.urls.forEach((url) => {
            resultTuples.add(`${url}|${type}`);
          });
        }
      });
    });

    // 3. Check that every paid (url, type) tuple is present in the result
    paidTuples.forEach((tuple) => {
      expect(resultTuples.has(tuple), `Paid url/type tuple missing from result: ${tuple}`).to.be.true;
    });

    // 4. Check that no non-paid (url, type) tuple is present in the result
    nonPaidTuples.forEach((tuple) => {
      expect(resultTuples.has(tuple), `Non-paid url/type tuple found in result: ${tuple}`).to.be.false;
    });
  });

  it('Returns empty metrics if trafficType does not match any bundle', async () => {
    const result = trafficMetrics.handler(bundlesWithTrafficSource.rumBundles, { ...options, trafficType: 'nonexistent' });
    result.forEach((group) => {
      expect(group.value, `Group ${group.key} should be empty`).to.be.an('array').that.is.empty;
    });
  });

  it('Handles case where ctr.weight is zero', async () => {
    // Bundle with no click events, so ctr.weight will be zero
    const noClickBundle = [{
      id: 'test1',
      url: '/no-click',
      userAgent: 'desktop:mac',
      weight: 0,
      events: [
        { checkpoint: 'enter', target: 'visible', source: 'https://www.example.com/' },
      ],
    }];
    const result = trafficMetrics.handler(noClickBundle, options);
    // Find the url grouping for our test bundle
    const urlGroup = result.find((g) => g.key === 'url');
    expect(urlGroup.value).to.have.lengthOf(1);
    const metrics = urlGroup.value[0];
    expect(metrics.ctr).to.equal(0);
    expect(metrics.clickedSessions).to.equal(0);
    expect(metrics.pageViews).to.equal(0);
    expect(metrics.clicksOverViews).to.equal(0);
    expect(metrics.bounceRate).to.equal(1);
    expect(metrics.totalNumClicks).to.equal(0);
    expect(metrics.avgClicksPerSession).to.equal(0);
  });
});
