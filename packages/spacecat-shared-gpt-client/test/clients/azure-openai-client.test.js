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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';
import AzureOpenAIClient from '../../src/clients/azure-openai-client.js';

use(chaiAsPromised);

describe('AzureOpenAIClient', () => {
  let mockLog;
  let sandbox;
  let mockContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = sinon.mock(console);
    mockContext = {
      log: mockLog.object,
      env: {
        AZURE_OPENAI_ENDPOINT: 'https://your-resource.openai.azure.com',
        AZURE_OPENAI_KEY: 'your-api-key',
        AZURE_API_VERSION: '2024-02-01',
        AZURE_COMPLETION_DEPLOYMENT: 'gpt-4o',
      },
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('constructor and createFrom', () => {
    it('throws errors for missing configuration using createFrom', () => {
      const incompleteContext = {
        env: {},
        log: console,
      };
      expect(() => AzureOpenAIClient.createFrom(incompleteContext)).to.throw('Missing Azure OpenAI API endpoint');
    });

    it('throws an error if the API endpoint is invalid', () => {
      mockContext.env.AZURE_OPENAI_ENDPOINT = '';
      expect(() => AzureOpenAIClient.createFrom(mockContext)).to.throw('Missing Azure OpenAI API endpoint');
    });

    it('throws an error if the API Key is invalid', () => {
      mockContext.env.AZURE_OPENAI_KEY = '';
      expect(() => AzureOpenAIClient.createFrom(mockContext)).to.throw('Missing Azure OpenAI API key');
    });

    it('throws an error if the API version is missing', () => {
      mockContext.env.AZURE_API_VERSION = '';
      expect(() => AzureOpenAIClient.createFrom(mockContext)).to.throw('Missing Azure OpenAI API version');
    });

    it('throws an error if the deployment name is missing', () => {
      mockContext.env.AZURE_COMPLETION_DEPLOYMENT = '';
      expect(() => AzureOpenAIClient.createFrom(mockContext)).to.throw('Missing Azure OpenAI deployment name');
    });

    it('creates client with all required values', () => {
      const client = AzureOpenAIClient.createFrom(mockContext);
      expect(client.config.apiVersion).to.equal('2024-02-01');
      expect(client.config.deploymentName).to.equal('gpt-4o');
    });

    it('creates client with custom values', () => {
      mockContext.env.AZURE_API_VERSION = '2024-03-01';
      mockContext.env.AZURE_COMPLETION_DEPLOYMENT = 'gpt-4-turbo';

      const client = AzureOpenAIClient.createFrom(mockContext);
      expect(client.config.apiVersion).to.equal('2024-03-01');
      expect(client.config.deploymentName).to.equal('gpt-4-turbo');
    });
  });

  // eslint-disable-next-line func-names
  describe('fetchChatCompletion', function () {
    this.timeout(3000);
    let client;
    const chatPath = '/openai/deployments/gpt-4o/chat/completions';
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
      model: 'gpt-4o',
    };

    beforeEach(() => {
      client = AzureOpenAIClient.createFrom(mockContext);
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
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt');
      expect(result.choices[0].message.content).to.equal('Test response');
      expect(result.model).to.equal('gpt-4o');
    });

    it('should handle null options', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt', null);
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should handle a bad response code', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(404, 'Not Found');

      await expect(client.fetchChatCompletion('Test prompt'))
        .to.be.rejectedWith('API call failed with status code 404');
    });

    it('should handle a bad response format', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices;

      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponseDup);

      await expect(client.fetchChatCompletion('Test prompt'))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('should handle a missing response message', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message;

      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponseDup);

      await expect(client.fetchChatCompletion('Test prompt'))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('should handle a missing response content', async () => {
      const chatResponseDup = JSON.parse(JSON.stringify(chatResponse));
      delete chatResponseDup.choices[0].message.content;

      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponseDup);

      await expect(client.fetchChatCompletion('Test prompt'))
        .to.be.rejectedWith('Prompt completed but no output was found.');
    });

    it('should handle image URLs', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const imageHttpsUrl = 'https://www.eatthis.com/wp-content/uploads/sites/4/2021/05/healthy-plate.jpg';

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          imageUrls: [imageHttpsUrl, base64ImageUrl, 'not_url so ignore'],
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should handle JSON response format', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          responseFormat: 'json_object',
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should handle both images and JSON format', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const imageHttpsUrl = 'https://www.eatthis.com/wp-content/uploads/sites/4/2021/05/healthy-plate.jpg';

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          imageUrls: [imageHttpsUrl],
          responseFormat: 'json_object',
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should filter out invalid image URLs', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          imageUrls: ['invalid-url', 'also-invalid', base64ImageUrl],
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should handle empty imageUrls array', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion(
        'Test prompt',
        {
          imageUrls: [],
        },
      );
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should log error and throw when API call fails', async () => {
      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post(chatPath)
        .query({ 'api-version': '2024-02-01' })
        .reply(500, 'Internal Server Error');

      mockLog.expects('error').once();
      await expect(client.fetchChatCompletion('Test prompt')).to.be.rejected;
      mockLog.verify();
    });

    it('should use correct API version in URL', async () => {
      mockContext.env.AZURE_API_VERSION = '2024-03-01';
      client = AzureOpenAIClient.createFrom(mockContext);

      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post('/openai/deployments/gpt-4o/chat/completions')
        .query({ 'api-version': '2024-03-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt');
      expect(result.choices[0].message.content).to.equal('Test response');
    });

    it('should use correct deployment name in URL', async () => {
      mockContext.env.AZURE_COMPLETION_DEPLOYMENT = 'gpt-4-turbo';
      client = AzureOpenAIClient.createFrom(mockContext);

      nock(mockContext.env.AZURE_OPENAI_ENDPOINT)
        .post('/openai/deployments/gpt-4-turbo/chat/completions')
        .query({ 'api-version': '2024-02-01' })
        .reply(200, chatResponse);

      const result = await client.fetchChatCompletion('Test prompt');
      expect(result.choices[0].message.content).to.equal('Test response');
    });
  });
});
