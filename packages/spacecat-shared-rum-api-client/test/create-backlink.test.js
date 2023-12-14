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

import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import RUMAPIClient from '../src/index.js';
import {
  emptyResponse, nullKeyResponse, successKeyResponse, wrongKeyResponse,
} from './rumapi-data.js';

chai.use(chaiAsPromised);
const { expect } = chai;

const sandbox = sinon.createSandbox();
const mockDate = '2023-11-27T12:30:01.124Z';
const sevenDaysLater = '2023-12-04T12:30:01.124Z';

describe('backlink creation', () => {
  const context = {
    env: {
      RUM_DOMAIN_KEY: 'domain-key',
    },
  };
  const finalUrl = 'www.space.cat';
  const params = {
    domainkey: context.env.RUM_DOMAIN_KEY,
    url: finalUrl,
    expiry: sevenDaysLater,
    note: 'generated by spacecat alerting',
  };

  before('setup', function () {
    this.clock = sandbox.useFakeTimers({
      now: new Date(mockDate).getTime(),
    });
  });

  after('clean', () => {
    sandbox.restore();
  });

  afterEach('clean each', () => {
    nock.cleanAll();
  });

  it('rejects when required params not provided', async () => {
    const client = RUMAPIClient.createFrom(context);

    await expect(client.createBacklink())
      .to.be.rejectedWith('Invalid input: url and expiry date parameters are required');
    await expect(client.createBacklink('url'))
      .to.be.rejectedWith('Invalid input: url and expiry date parameters are required');
  });

  it('rejects when rum api returns empty repsonse', async () => {
    const client = RUMAPIClient.createFrom(context);

    nock('https://helix-pages.anywhere.run')
      .post('/helix-services/run-query@v3/rotate-domainkeys')
      .query(params)
      .reply(200, emptyResponse);

    await expect(client.createBacklink(finalUrl, 7))
      .to.be.rejectedWith('Unexpected response: Rum api returned empty result');
  });

  it('rejects when rum api returns unsuccessful repsonse', async () => {
    const client = RUMAPIClient.createFrom(context);

    nock('https://helix-pages.anywhere.run')
      .post('/helix-services/run-query@v3/rotate-domainkeys')
      .query(params)
      .reply(200, wrongKeyResponse);

    await expect(client.createBacklink(finalUrl, 7))
      .to.be.rejectedWith('Unexpected response: Response was not successful');
  });

  it('rejects when rum api returns null key', async () => {
    const client = RUMAPIClient.createFrom(context);

    nock('https://helix-pages.anywhere.run')
      .post('/helix-services/run-query@v3/rotate-domainkeys')
      .query(params)
      .reply(200, nullKeyResponse);

    await expect(client.createBacklink(finalUrl, 7))
      .to.be.rejectedWith('Rum api returned null domain key');
  });

  it('returns scoped domain key when successful', async () => {
    const client = RUMAPIClient.createFrom(context);
    const expectedBacklink = 'https://main--franklin-dashboard--adobe.hlx.live/views/rum-dashboard?interval=7&offset=0&limit=100&url=www.space.cat&domainkey=scoped-domain-key';

    nock('https://helix-pages.anywhere.run')
      .post('/helix-services/run-query@v3/rotate-domainkeys')
      .query(params)
      .reply(200, successKeyResponse);

    const backlink = await client.createBacklink(finalUrl, 7);
    expect(backlink).to.equal(expectedBacklink);
  });
});
