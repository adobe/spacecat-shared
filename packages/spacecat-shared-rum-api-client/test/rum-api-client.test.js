/*
 * Copyright 2023 Adobe. All rights reserved.
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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import RUMAPIClient, { sendRequest } from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('rum api client', () => {
  afterEach('clean each', () => {
    nock.cleanAll();
  });

  it('does not create a new instance if previously initialized', async () => {
    const rumApiClient = RUMAPIClient.createFrom({ rumApiClient: 'hebele', env: {} });
    expect(rumApiClient).to.equal('hebele');
  });

  it('rejects no domain key set', async () => {
    expect(() => RUMAPIClient.createFrom({ env: {} })).to.throw('RUM API Client needs a domain key to be set');
  });

  it('rejects when rum api returns 500', async () => {
    nock('https://space.cat')
      .get('/dummy-page')
      .reply(500);

    await expect(sendRequest('https://space.cat/dummy-page')).to.be.rejectedWith('Error during rum api call: Unexpected end of JSON input');
  });

  it('rejects when rum api returns invalid json', async () => {
    nock('https://space.cat')
      .get('/dummy-page')
      .query(true)
      .reply(200, 'invalid-json');

    await expect(sendRequest('https://space.cat/dummy-page')).to.be.rejectedWith('Error during rum api call: Unexpected token');
  });

  it('rejects when rum api returns unexpected format', async () => {
    nock('https://space.cat')
      .get('/dummy-page')
      .query(true)
      .reply(200, '{ "key": "value" }');

    await expect(sendRequest('https://space.cat/dummy-page'))
      .to.be.rejectedWith('Unexpected response from rum api. $.results.data is not array');
  });

  it('returns data when getRUMDashboard api is successful', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/rum-dashboard')
      .query({
        domainkey: 'hebele',
        interval: 7,
        offset: 0,
        limit: 101,
      })
      .reply(200, JSON.stringify({
        results: {
          data: [{
            url: 'http://spacecar.com',
            pageviews: 11000,
            avgcls: 0.148,
            avginp: 65,
            avglcp: 5239,
          }],
        },
      }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getRUMDashboard())
      .to.eventually.eql([{
        url: 'http://spacecar.com',
        pageviews: 11000,
        avgcls: 0.148,
        avginp: 65,
        avglcp: 5239,
      }]);
  });

  it('returns data when get404Sources api is successful', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/rum-sources')
      .query({
        domainkey: 'hebele',
        interval: 7,
        offset: 0,
        limit: 101,
        checkpoint: 404,
      })
      .reply(200, JSON.stringify({ results: { data: [{ url: 'http://spacecar.com', views: 100, sources: 'www.google.com' }] } }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.get404Sources())
      .to.eventually.eql([{ url: 'http://spacecar.com', views: 100, sources: 'www.google.com' }]);
  });

  it('returns data when getExperimentationData api is successful', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/rum-experiments')
      .query({
        domainkey: 'hebele',
        interval: 7,
        offset: 0,
        limit: 101,
        url: 'http://spacecat.com',
      })
      .reply(200, JSON.stringify({
        results: {
          data: [{
            experiment: '2-21-free-trial-cp-delay-load',
            variant: 'challenger-2',
            tdiff: 6,
            variant_experimentation_events: 24,
            control_experimentation_events: 21,
            variant_conversion_events: 14,
            control_conversion_events: 12,
            variant_experimentations: '2400',
            control_experimentations: '2100',
            variant_conversions: '1400',
            control_conversions: '1200',
            variant_conversion_rate: '0.583333333',
            control_conversion_rate: '0.571428571',
            topurl: 'http://spacecat.com',
            time95: '2024-02-05 16:00:55+00',
            time5: '2024-01-30 00:00:45+00',
            pooled_sample_proportion: 0.5777777777777777,
            pooled_standard_error: 0.75992086289346,
            test: 0.015665791770305738,
            p_value: 0.4937504754112301,
            remaining_runtime: 57,
          }],
        },
      }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getExperimentationData({ url: 'http://spacecat.com' }))
      .to.eventually.eql([{
        experiment: '2-21-free-trial-cp-delay-load',
        variant: 'challenger-2',
        tdiff: 6,
        variant_experimentation_events: 24,
        control_experimentation_events: 21,
        variant_conversion_events: 14,
        control_conversion_events: 12,
        variant_experimentations: '2400',
        control_experimentations: '2100',
        variant_conversions: '1400',
        control_conversions: '1200',
        variant_conversion_rate: '0.583333333',
        control_conversion_rate: '0.571428571',
        topurl: 'http://spacecat.com',
        time95: '2024-02-05 16:00:55+00',
        time5: '2024-01-30 00:00:45+00',
        pooled_sample_proportion: 0.5777777777777777,
        pooled_standard_error: 0.75992086289346,
        test: 0.015665791770305738,
        p_value: 0.4937504754112301,
        remaining_runtime: 57,
      }]);
  });

  it('returns data when getDomainList api is successful for all', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/dash/domain-list')
      .query({
        domainkey: 'hebele',
        interval: 30,
        offset: 0,
        limit: 100000,
      })
      .reply(200, JSON.stringify({ results: { data: [] } }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getDomainList({}, 'all'))
      .to.be.fulfilled;
  });

  it('returns data when getDomainList api is successful for a domain', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/dash/domain-list')
      .query({
        domainkey: 'hebele',
        interval: 30,
        offset: 0,
        limit: 100000,
      })
      .reply(200, JSON.stringify({
        results: {
          data: [
            { hostname: 'spacecat.com' },
            { hostname: 'spacekatze.com' }],
        },
      }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getDomainList()).to.eventually.eql(['spacecat.com', 'spacekatze.com']);
  });

  it('returns data when getConversionData api is successful', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/rum-sources-targets')
      .query({
        domainkey: 'hebele',
        interval: 7,
        offset: 0,
        limit: 101,
        checkpoint: 'convert',
        url: 'http://spacecat.com',
      })
      .reply(200, JSON.stringify({
        results: {
          data: [{
            checkpoint: 'convert',
            source: 'get-a-demo',
            target: null,
            ids: 56,
            pages: 3,
            topurl: 'https://www.spacecat.com/g2/',
            user_agents: 2,
            top_user_agent: 'desktop',
            views: '1482',
            actions: '1482',
          },
          {
            checkpoint: 'convert',
            source: 'start-free-trial',
            target: null,
            ids: 8,
            pages: 3,
            topurl: 'https://www.spacecat.com/g2/',
            user_agents: 2,
            top_user_agent: 'desktop',
            views: '480',
            actions: '480',
          }],
        },
      }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getConversionData({ url: 'http://spacecat.com' }))
      .to.eventually.eql([{
        checkpoint: 'convert',
        source: 'get-a-demo',
        target: null,
        ids: 56,
        pages: 3,
        topurl: 'https://www.spacecat.com/g2/',
        user_agents: 2,
        top_user_agent: 'desktop',
        views: '1482',
        actions: '1482',
      },
      {
        checkpoint: 'convert',
        source: 'start-free-trial',
        target: null,
        ids: 8,
        pages: 3,
        topurl: 'https://www.spacecat.com/g2/',
        user_agents: 2,
        top_user_agent: 'desktop',
        views: '480',
        actions: '480',
      }]);
  });

  it('returns data when getRUMFormsDashboard api is successful', async () => {
    nock('https://helix-pages.anywhere.run/helix-services')
      .get('/run-query@v3/rum-forms-dashboard')
      .query({
        domainkey: 'hebele',
        interval: 7,
        offset: 0,
        limit: 101,
        checkpoint: 'convert',
        url: 'http://spacecat.com',
      })
      .reply(200, JSON.stringify({
        results: {
          data: [{
            url: 'https://www.spacecat.com/pl/onboarding-checklist',
            views: '4400',
            avglcp: 2172,
            avgcls: 0.148,
            avginp: 96,
            avgfid: 8,
            submissions: '500',
          },
          {
            url: 'https://www.spacecat.com/pl-pages/human-resources',
            views: '4300',
            avglcp: 5802,
            avgcls: 0.065,
            avginp: 72,
            avgfid: 13,
            submissions: '0',
          }],
        },
      }));
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    await expect(rumApiClient.getRUMFormsDashboard({ url: 'http://spacecat.com' }))
      .to.eventually.eql([{
        url: 'https://www.spacecat.com/pl/onboarding-checklist',
        views: '4400',
        avglcp: 2172,
        avgcls: 0.148,
        avginp: 96,
        avgfid: 8,
        submissions: '500',
      },
      {
        url: 'https://www.spacecat.com/pl-pages/human-resources',
        views: '4300',
        avglcp: 5802,
        avgcls: 0.065,
        avginp: 72,
        avgfid: 13,
        submissions: '0',
      }]);
  });
});
