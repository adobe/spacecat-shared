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

  it('returns the URL to call the get404Sources', () => {
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    expect(rumApiClient.create404URL({ url: 'http://spacecar.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-sources?domainkey=hebele&interval=7&offset=0&limit=101&checkpoint=404&url=http%3A%2F%2Fspacecar.com');
  });

  it('returns the URL to call the getRUMDashboard', () => {
    const rumApiClient = RUMAPIClient.createFrom({ env: { RUM_DOMAIN_KEY: 'hebele' } });
    expect(rumApiClient.createRUMURL({ url: 'http://spacecar.com' }))
      .to.eql('https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-dashboard?domainkey=hebele&interval=7&offset=0&limit=101&url=http%3A%2F%2Fspacecar.com');
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
});
