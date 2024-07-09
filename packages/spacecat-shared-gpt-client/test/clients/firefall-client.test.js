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
import sinon from 'sinon';
import FirefallClient from '../../src/clients/firefall-client.js';

chai.use(chaiAsPromised);

const { expect } = chai;

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

  describe('fetch', function () {
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
      await expect(client.fetch('Test prompt')).to.be.rejected;
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
      await expect(client.fetch('Test prompt')).to.be.rejected;
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

      await expect(client.fetch('Test prompt')).to.be.rejectedWith('Invalid response format.');
    });
  });

  describe('executePromptChain', async () => {
    let client;

    beforeEach(() => {
      client = FirefallClient.createFrom(mockContext);
    });

    it('executes a prompt chain successfully using conversation API', async () => {
      const chainConfig = {
        steps: [
          {
            prompt: 'What is the capital of France?',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onResponse: (response) => ({ context: { capital: 'Paris' } }),
          },
          {
            prompt: 'What is the population of {{capital}}?',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onResponse: (response) => ({ context: { population: '2 million' } }),
          },
        ],
      };

      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post('/v2/conversations')
        .reply(200, { conversation_id: 'sessionId' })
        .post('/v2/conversations/sessionId/messages')
        .reply(200, { messages: [{ id: 'messageId1', content: 'Paris', status: 'SUCCEEDED' }] })
        .get('/v2/conversations/sessionId/messages/messageId1')
        .reply(200, { messages: [{ content: 'Paris' }], status: 'SUCCEEDED' })
        .post('/v2/conversations/sessionId/messages')
        .reply(200, { messages: [{ id: 'messageId2', content: '2 million', status: 'SUCCEEDED' }] })
        .get('/v2/conversations/sessionId/messages/messageId2')
        .reply(200, { messages: [{ content: '2 million' }], status: 'SUCCEEDED' });

      const result = await client.executePromptChain(chainConfig);
      expect(result).to.eql({ capital: 'Paris', population: '2 million' });
    });
  });
});
