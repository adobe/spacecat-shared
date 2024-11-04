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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';
import FirefallClient from '../../src/clients/firefall-client.js';

use(chaiAsPromised);

describe('FirefallClient', () => {
  let mockLog;
  let sandbox;
  let mockContext;

  const IMS_ENV = {
    IMS_HOST: 'ims.example.com',
    IMS_CLIENT_ID: 'yourClientId',
    IMS_CLIENT_CODE: 'yourClientCode',
    IMS_CLIENT_SECRET: 'yourClientSecret',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = sinon.mock(console);
    mockContext = {
      log: mockLog.object,
      env: {
        FIREFALL_API_ENDPOINT: 'https://api.firefall.example.com',
        FIREFALL_API_KEY: 'apiKeyExample',
        FIREFALL_API_POLL_INTERVAL: 100,
        FIREFALL_API_CAPABILITY_NAME: 'gpt4_32k_completions_capability',
        ...IMS_ENV,
      },
    };

    nock(`https://${mockContext.env.IMS_HOST}`)
      .post('/ims/token/v4')
      .reply(200, { access_token: 'accessToken' });
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('constructor and createFrom', () => {
    it('throws errors for missing configuration using createFrom', () => {
      const incompleteContext = {
        env: IMS_ENV,
        log: console,
      };
      expect(() => FirefallClient.createFrom(incompleteContext)).to.throw('Missing Firefall API endpoint');
    });

    it('throws an error if the API endpoint is invalid', () => {
      mockContext.env.FIREFALL_API_ENDPOINT = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall API endpoint');
    });

    it('throws an error if the API Key is invalid', () => {
      mockContext.env.FIREFALL_API_KEY = '';
      expect(() => FirefallClient.createFrom(mockContext)).to.throw('Missing Firefall API key');
    });
  });

  describe('fetchCapabilityExecution', () => {
    this.timeout(3000);
    let client;

    beforeEach(() => {
      client = FirefallClient.createFrom(mockContext);
    });

    it('should throw an error for invalid prompt', async () => {
      await expect(client.fetch('')).to.be.rejectedWith('Invalid prompt received');
    });

    it('should successfully fetch data', async () => {
      const mockJobId = '12345';
      const mockResponse = {
        generations: [[{ text: 'Test response' }]],
      };

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .get(`/v2/capability_execution/job/${mockJobId}`)
        .reply(200, { status: 'SUCCEEDED', output: { capability_response: mockResponse } });

      const result = await client.fetch('Test prompt');
      expect(result).to.equal('Test response');
    });

    it('should log and throw an error if the job submission fails', async () => {
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(400);

      mockLog.expects('error').once();
      await expect(client.fetchCapabilityExecution('Test prompt')).to.be.rejected;
      mockLog.verify();
    });

    it('logs and throws an error if the job status polling fails', async () => {
      const mockJobId = '12345';
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .get(`/v2/capability_execution/job/${mockJobId}`)
        .reply(400);

      mockLog.expects('error').once();
      await expect(client.fetchCapabilityExecution('Test prompt')).to.be.rejected;
      mockLog.verify();
    });

    it('throws an error if the job status is not SUCCEEDED', async () => {
      const mockJobId = 'job-failure';
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .get(`/v2/capability_execution/job/${mockJobId}`)
        .reply(200, { status: 'FAILED' });

      mockLog.expects('error').once();
      await expect(client.fetch('Test prompt')).to.be.rejectedWith('Job did not succeed, status: FAILED');
      mockLog.verify();
    });

    it('throws an error if the job completed but no output was found', async () => {
      const mockJobId = 'no-output';
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .get(`/v2/capability_execution/job/${mockJobId}`)
        .reply(200, { status: 'SUCCEEDED' }); // Reply without output

      await expect(client.fetch('Test prompt')).to.be.rejectedWith('Job completed but no output was found');
    });

    it('logs and throws an error for invalid response format', async () => {
      const mockJobId = 'invalid-format';
      const invalidResponse = {
        generations: [{}], // Invalid response format
      };

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/capability_execution/job')
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .get(`/v2/capability_execution/job/${mockJobId}`)
        .reply(200, { status: 'SUCCEEDED', output: { capability_response: invalidResponse } });

      await expect(client.fetchCapabilityExecution('Test prompt')).to.be.rejectedWith('Invalid response format.');
    });
  });

  describe('fetchChatCompletion', () => {
    const chatPath = '/v2/chat/completions';
    const chatResponse = {
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: {
            content: 'Test response',
            role: 'assistant',
          },
        },
      ],
      model: 'hello',
    };
    this.timeout(3000);
    let client;

    beforeEach(() => {
      client = FirefallClient.createFrom(mockContext);
    });

    afterEach(() => {
      nock.cleanAll();
      sandbox.restore();
    });

    it('should throw an error for invalid prompt', async () => {
      await expect(client.fetchChatCompletion(''))
        .to.be.rejectedWith('Invalid prompt received');
    });

    it('should throw an error for invalid options', async () => {
      await expect(client.fetchChatCompletion('prompt this', { imageUrls: 'string' }))
        .to.be.rejectedWith('imageUrls must be an array.');
    });

    it('should handle no options', async () => {
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt', null);
      expect(result.choices[0].message.content).to.equal('Test response');
      expect(result.model).to.equal('hello');
    });

    it('should handle a bad response', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);
      const imageUrl = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYA...=';

      mockLog.expects('warn').once().withArgs('Image URLs were provided but capability (gpt4_32k_completions_capability) may not handle vision prompts. Continuing...');
      await expect(client.fetchChatCompletion('Test prompt', { imageUrls: [imageUrl] }))
        .to.be.rejectedWith('Invalid response format.');
      mockLog.verify();
    });

    it('should handle a missing response message', async () => {
      // Run this with a different capability.
      mockContext.env.FIREFALL_API_CAPABILITY_NAME = 'gpt-4-vision';
      const clientCapacity = FirefallClient.createFrom(mockContext);
      const logSpy = sinon.spy(mockContext.log, 'warn');

      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);
      const imageUrl = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYA...=';

      await expect(clientCapacity.fetchChatCompletion(
        'Test prompt',
        { imageUrls: [imageUrl] },
      ))
        .to.be.rejectedWith('Invalid response format.');

      // Modal (capacity) handles vision prompts, so no warning should be logged.
      expect(logSpy.callCount).to.equal(0);
    });

    it('should handle a missing response content', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message.content;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);
      const imageUrl = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYA...=';

      await expect(client.fetchChatCompletion('Test prompt', { imageUrls: [imageUrl] }))
        .to.be.rejectedWith('Prompt completed but no output was found.');
    });

    // Image docs: https://wiki.corp.adobe.com/pages/viewpage.action?spaceKey=adobeds&title=tutorial+-+using+firefall+generative+APIs
    it('should handle good options', async () => {
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponse);
      const imageUrl = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYA...=';

      const result = await client.fetchChatCompletion('Test prompt', { imageUrls: [imageUrl] });
      expect(result.choices[0].message.content).to.equal('Test response');
      expect(result.model).to.equal('hello');
    });
  });
});
