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
import nock from 'nock';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import FirefallClient from '../../src/clients/firefall-client.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('FirefallClient', () => {
  let sandbox;
  let mockContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockContext = {
      log: {
        debug: sandbox.spy(),
        error: sandbox.spy(),
      },
      env: {
        FIREFALL_API_ENDPOINT: 'https://api.firefall.example.com',
        FIREFALL_IMS_ORG: 'exampleOrg',
        FIREFALL_API_KEY: 'apiKeyExample',
        FIREFALL_API_AUTH: 'apiAuthExample',
      },
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createFrom', () => {
    it('creates a new FirefallClient with the correct configuration', () => {
      const client = FirefallClient.createFrom(mockContext);
      expect(client).to.be.an.instanceof(FirefallClient);
      expect(client.config).to.deep.equal({
        apiEndpoint: 'https://api.firefall.example.com',
        imsOrg: 'exampleOrg',
        apiKey: 'apiKeyExample',
        apiAuth: 'apiAuthExample',
      });
    });

    it('throws an error if the API endpoint is invalid', () => {
      mockContext.env.FIREFALL_API_ENDPOINT = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall API endpoint');
    });

    it('throws an error if the IMS Org is invalid', () => {
      mockContext.env.FIREFALL_IMS_ORG = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall IMS Org');
    });

    it('throws an error if the API Key is invalid', () => {
      mockContext.env.FIREFALL_API_KEY = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall API key');
    });

    it('throws an error if the API Auth is invalid', () => {
      mockContext.env.FIREFALL_API_AUTH = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall API auth');
    });
  });

  describe('fetch', () => {
    const apiEndpoint = 'https://api.firefall.example.com';
    const prompt = 'What is Firefall?';
    const responseBody = {
      generations: [[{ text: '{"insights":[{"insight":"test","recommendation":"use chai","code":"success"}]}' }]],
    };
    const mockLog = {
      debug: sinon.spy(),
      error: sinon.spy(),
    };

    let client;
    let mockApi;

    beforeEach(() => {
      mockApi = nock(apiEndpoint);
      client = new FirefallClient({
        apiEndpoint,
        imsOrg: 'exampleOrg',
        apiKey: 'apiKeyExample',
        apiAuth: 'apiAuthExample',
      }, mockLog);
    });

    afterEach(() => {
      nock.cleanAll();
    });

    it('successfully fetches data from the Firefall API', async () => {
      mockApi.post('/').reply(200, responseBody);

      const result = await client.fetch(prompt);
      expect(result).to.deep.equal(JSON.parse(responseBody.generations[0][0].text));
    });

    it('handles API response with status code other than 200', async () => {
      mockApi.post('/').reply(404);

      await expect(client.fetch(prompt)).to.be.rejectedWith('Firefall API returned status code 404');
    });

    it('throws an error if the prompt is invalid', () => {
      expect(client.fetch('')).to.be.rejectedWith('Invalid prompt received');
    });

    it('logs duration of the API call', async () => {
      nock(apiEndpoint)
        .post('/')
        .reply(200, responseBody);

      await client.fetch(prompt);
      expect(mockLog.debug.called).to.be.true;
    });

    it('throws an error when response is not valid JSON', async () => {
      const invalidResponseBody = { generations: [[{ text: 'someValue.' }]] };
      nock(apiEndpoint)
        .post('/')
        .reply(200, invalidResponseBody);

      await expect(client.fetch(prompt)).to.be.rejectedWith('Returned Data from Firefall is not a JSON object.');
    });

    it('throws an error when response is not an object', async () => {
      const invalidResponseBody = { generations: [[{ text: '[]' }]] };
      nock(apiEndpoint)
        .post('/')
        .reply(200, invalidResponseBody);

      await expect(client.fetch(prompt)).to.be.rejectedWith('Invalid response format.');
    });

    it('throws an error when response is not an array', async () => {
      const invalidResponseBody = { generations: [[{ text: '{ "insights": "" }' }]] };
      nock(apiEndpoint)
        .post('/')
        .reply(200, invalidResponseBody);

      await expect(client.fetch(prompt)).to.be.rejectedWith('Invalid response format.');
    });

    it('throws an error when generations object is missing', async () => {
      const invalidResponseBody = { generations: [] }; // Missing inner array
      nock(apiEndpoint)
        .post('/')
        .reply(200, invalidResponseBody);

      await expect(client.fetch(prompt)).to.be.rejectedWith('Generations object is missing.');
    });
  });
});
