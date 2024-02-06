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
        IMS_URL: 'https://ims.com',
        AA_CLIENT_ID: 'test',
        AA_CLIENT_SECRET: 'secret',
        AA_SCOPES: 'test',
        AA_DOMAIN: 'test',
      },
    };
  });
  afterEach('clean each', () => {
    nock.cleanAll();
  });

  it('does not create a new instance if previously initialized', async () => {
    const aaApiClient = AAAPIClient.create({ aaApiClient: 'hebele', env: context.env });
    expect(aaApiClient).to.equal('hebele');
  });

  it('rejects when one of the AA parameter missing', async () => {
    expect(() => AAAPIClient.create(context)).to.throw('AA API Client needs a IMS_URL, AA_CLIENT_ID, AA_CLIENT_SECRET, AA_SCOPES, AA_DMAIN keys to be set');
  });
});
