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
import GenvarClient from '../../src/clients/genvar-client.js';

use(chaiAsPromised);

describe('GenvarClient', () => {
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
        GENVAR_HOST: 'https://api.genvar.example.com',
        GENVAR_API_POLL_INTERVAL: 100,
        GENVAR_IMS_ORG_ID: 'abcd@adobeOrg',
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
      expect(() => GenvarClient.createFrom(incompleteContext)).to.throw('Missing Genvar API endpoint');
    });

    it('throws an error if the API endpoint is invalid', () => {
      mockContext.env.FIREFALL_API_ENDPOINT = '';
      expect(() => GenvarClient.createFrom(mockContext)).to.throw('Missing Genvar API endpoint');
    });
  });

  // eslint-disable-next-line func-names
  describe('generateSuggestions', function () {
    this.timeout(4000);
    let client;
    let requestBody;
    let endpoint;

    beforeEach(() => {
      client = GenvarClient.createFrom(mockContext);
      endpoint = '/test-path';
      requestBody = {
        baseUrl: 'www.example.com',
        healthyTags: {
          title: ['title-1', 'title-2'],
          description: ['description-1'],
          h1: ['h1-1'],
        },
        detectedTags: {
          '/test': {
            title: {
              issue: 'Missing Title',
            },
          },
        },
      };
    });

    it('should throw an error for invalid arguments', async () => {
      await expect(client.generateSuggestions()).to.be.rejectedWith('Invalid body received');
    });

    it('should successfully call genvar api', async () => {
      const mockJobId = '12345';
      const mockResponse = {
        status: 'completed',
        result: {
          '/abc': {
            aiSuggestions: 'ai-generated-suggestions',
          },
        },
      };

      nock(mockContext.env.GENVAR_HOST)
        .post(endpoint)
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.GENVAR_HOST)
        .get(`${endpoint}?jobId=${mockJobId}`)
        .reply(200, mockResponse);

      const result = await client.generateSuggestions(requestBody, endpoint);
      expect(result).to.equal({
        '/abc': {
          aiSuggestions: 'ai-generated-suggestions',
        },
      });
    });

    it('should log and throw an error if the job submission fails', async () => {
      nock(mockContext.env.GENVAR_HOST)
        .post(endpoint)
        .reply(400);

      mockLog.expects('error').once();
      await expect(client.generateSuggestions(requestBody, endpoint)).to.be.rejected;
      mockLog.verify();
    });

    it('logs and throws an error if the job status polling fails', async () => {
      const mockJobId = '12345';
      nock(mockContext.env.GENVAR_HOST)
        .post(endpoint)
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.GENVAR_HOST)
        .get(`${endpoint}?jobId=12345`)
        .reply(400);

      mockLog.expects('error').once();
      await expect(client.generateSuggestions(requestBody, endpoint)).to.be.rejected;
      mockLog.verify();
    });

    it('throws an error if the job status is not SUCCEEDED', async () => {
      const mockJobId = 'job-failure';
      nock(mockContext.env.GENVAR_HOST)
        .post(endpoint)
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.GENVAR_HOST)
        .get(`${endpoint}?jobId=job-failure`)
        .reply(200, { status: 'FAILED' });

      mockLog.expects('error').once();
      await expect(client.generateSuggestions(requestBody, endpoint)).to.be.rejectedWith('Job did not succeed, status: FAILED');
      mockLog.verify();
    });

    it('throws an error if the job completed but no output was found', async () => {
      const mockJobId = 'no-output';
      nock(mockContext.env.GENVAR_HOST)
        .post(endpoint)
        .reply(200, { job_id: mockJobId });

      nock(mockContext.env.GENVAR_HOST)
        .get(`${endpoint}?jobId=${mockJobId}`)
        .reply(200, { status: 'completed' }); // Reply without output

      await expect(client.generateSuggestions(requestBody, endpoint)).to.be.rejectedWith('Job completed but no output was found');
    });
  });

  // eslint-disable-next-line func-names
  describe('generate Metatags suggestions', function () {
    const chatPath = '/v2/chat/completions';
    const base64ImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYA...=';
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
      client = GenvarClient.createFrom(mockContext);
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
      mockContext.env.FIREFALL_IMS_ORG = 'myOrgId@adobe.com';
      client = GenvarClient.createFrom(mockContext);
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt', null);
      expect(result.choices[0].message.content).to.equal('Test response');
      expect(result.model).to.equal('hello');
    });

    it('should handle a bad response code', async () => {
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(404, 'Not Found');

      await expect(client.fetchChatCompletion('Test prompt'))
        .to.be.rejectedWith('Job submission failed with status code 404');
    });

    it('should handle a bad response', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);
      const options = {
        imageUrls: [base64ImageUrl],
        model: 'gpt-4-turbo',
        responseFormat: 'json_object',
      };

      await expect(client.fetchChatCompletion('Test prompt', options))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('should handle a missing response message', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);

      await expect(client.fetchChatCompletion(
        'Test prompt',
        { imageUrls: [base64ImageUrl], model: 'gpt-4-vision', responseFormat: 'ignored' },
      ))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('should handle a missing response content', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message.content;
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponseDup);

      await expect(client.fetchChatCompletion('Test prompt', { imageUrls: [base64ImageUrl] }))
        .to.be.rejectedWith('Prompt completed but no output was found.');
    });

    // Image docs: https://wiki.corp.adobe.com/pages/viewpage.action?spaceKey=adobeds&title=tutorial+-+using+firefall+generative+APIs
    it('should handle good options', async () => {
      nock(mockContext.env.FIREFALL_API_ENDPOINT)
        .post(chatPath)
        .reply(200, chatResponse);
      const imageHttpsUrl = 'https://www.eatthis.com/wp-content/uploads/sites/4/2021/05/healthy-plate.jpg';

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          imageUrls: [imageHttpsUrl, base64ImageUrl, 'not_url so ignore'], model: 'gpt-4-vision',
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
      expect(result.model).to.equal('hello');
    });
  });
});
