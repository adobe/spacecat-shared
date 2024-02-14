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
/* eslint-env mocha */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import AAAPIClient from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Adobe Analytics api client', () => {
  let context;
  beforeEach(() => {
    context = {
      env: {
        AA_CLIENT_ID: process.env.AA_CLIENT_ID || 'test',
        AA_CLIENT_SECRET: process.env.AA_CLIENT_SECRET || 'test',
        AA_DOMAIN: 'test',
      },
    };
  });
  afterEach('clean each', () => {
    nock.cleanAll();
  });
  it('should fail with missing required config', async () => {
    context.env.AA_CLIENT_ID = '';
    try {
      await AAAPIClient.create(context);
    } catch (err) {
      expect(err.message).equal('Missing required config: AA_CLIENT_ID');
    }
  });
  it('should fail in case wrong clientid/secret on create AAAPIClient', async () => {
    nock('https://ims-na1.adobelogin.com')
      .post('/ims/token/v3')
      .reply(400, { error: 'Bad Request' });
    try {
      await AAAPIClient.create(context);
    } catch (err) {
      expect(err.message).equal('POST request failed with status 400: ');
    }
  });
  it('should return same object by calling static creation again and again', async () => {
    nock('https://ims-na1.adobelogin.com')
      .post('/ims/token/v3')
      .reply(200, { access_token: 'test' });
    const aaApiClient = await AAAPIClient.create(context);
    const aaApiClient2 = await AAAPIClient.create(context);
    expect(aaApiClient2).to.be.an('object');
    expect(aaApiClient).to.be.an('object');
  });
  it('call validateFileFormat with valid file', async () => {
    nock('https://ims-na1.adobelogin.com')
      .post('/ims/token/v3')
      .reply(200, { access_token: 'test' });
    const aaApiClient = await AAAPIClient.create(context);
    const file = {
      name: 'test.zip',
      buffer: Buffer.from('test'),
    };
    nock('https://analytics-collection.adobe.io')
      .post('/aa/collect/v1/events/validate')
      .reply(204, {});
    const result = await aaApiClient.validateFileFormat(file);
    expect(result).to.throw;
  });
  it('call ingestEvents with valid file', async () => {
    nock('https://ims-na1.adobelogin.com')
      .post('/ims/token/v3')
      .reply(200, { access_token: 'test' });
    const aaApiClient = await AAAPIClient.create(context);
    const file = {
      name: 'test.zip',
      buffer: Buffer.from('test'),
    };
    nock('https://analytics-collection.adobe.io')
      .post('/aa/collect/v1/events')
      .reply(204, {});
    const result = await aaApiClient.ingestEvents(file);
    expect(result).to.throw;
  });
});
