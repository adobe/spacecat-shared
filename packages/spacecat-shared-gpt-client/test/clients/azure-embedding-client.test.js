/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';
import AzureEmbeddingClient from '../../src/clients/azure-embedding-client.js';

use(chaiAsPromised);

describe('AzureEmbeddingClient', () => {
  let mockLog;
  let sandbox;
  let mockContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = {
      debug: sandbox.stub(),
      info: sandbox.stub(),
      error: sandbox.stub(),
    };
    mockContext = {
      log: mockLog,
      env: {
        AZURE_EMBEDDING_ENDPOINT: 'https://your-resource.openai.azure.com',
        AZURE_EMBEDDING_KEY: 'your-api-key',
        AZURE_EMBEDDING_API_VERSION: '2024-02-01',
        AZURE_EMBEDDING_DEPLOYMENT: 'text-embedding-3-small',
      },
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('constructor and createFrom', () => {
    it('defaults log to console when not provided', () => {
      const client = AzureEmbeddingClient.createFrom({ env: mockContext.env });
      expect(client.log).to.equal(console);
    });

    it('throws when the endpoint is missing', () => {
      expect(() => AzureEmbeddingClient.createFrom({ env: {}, log: mockLog }))
        .to.throw('Missing Azure OpenAI embedding endpoint');
    });

    it('throws when the endpoint is invalid', () => {
      mockContext.env.AZURE_EMBEDDING_ENDPOINT = 'not-a-url';
      expect(() => AzureEmbeddingClient.createFrom(mockContext))
        .to.throw('Missing Azure OpenAI embedding endpoint');
    });

    it('throws when the API key is missing', () => {
      mockContext.env.AZURE_EMBEDDING_KEY = '';
      expect(() => AzureEmbeddingClient.createFrom(mockContext))
        .to.throw('Missing Azure OpenAI embedding API key');
    });

    it('throws when the API version is missing', () => {
      mockContext.env.AZURE_EMBEDDING_API_VERSION = '';
      expect(() => AzureEmbeddingClient.createFrom(mockContext))
        .to.throw('Missing Azure OpenAI embedding API version');
    });

    it('throws when the deployment name is missing', () => {
      mockContext.env.AZURE_EMBEDDING_DEPLOYMENT = '';
      expect(() => AzureEmbeddingClient.createFrom(mockContext))
        .to.throw('Missing Azure OpenAI embedding deployment name');
    });

    it('creates a client from the dedicated AZURE_EMBEDDING_* values', () => {
      const client = AzureEmbeddingClient.createFrom(mockContext);
      expect(client.config.apiEndpoint).to.equal('https://your-resource.openai.azure.com');
      expect(client.config.apiKey).to.equal('your-api-key');
      expect(client.config.apiVersion).to.equal('2024-02-01');
      expect(client.config.deploymentName).to.equal('text-embedding-3-small');
    });

    it('falls back to AZURE_OPENAI_* for endpoint/key/version (embeddings share the resource)', () => {
      const client = AzureEmbeddingClient.createFrom({
        log: mockLog,
        env: {
          AZURE_OPENAI_ENDPOINT: 'https://shared-resource.openai.azure.com',
          AZURE_OPENAI_KEY: 'shared-key',
          AZURE_API_VERSION: '2024-06-01',
          AZURE_EMBEDDING_DEPLOYMENT: 'text-embedding-3-small',
        },
      });
      expect(client.config.apiEndpoint).to.equal('https://shared-resource.openai.azure.com');
      expect(client.config.apiKey).to.equal('shared-key');
      expect(client.config.apiVersion).to.equal('2024-06-01');
      expect(client.config.deploymentName).to.equal('text-embedding-3-small');
    });
  });

  // eslint-disable-next-line func-names
  describe('createEmbeddings', function () {
    this.timeout(3000);
    let client;
    const path = '/openai/deployments/text-embedding-3-small/embeddings';

    beforeEach(() => {
      client = AzureEmbeddingClient.createFrom(mockContext);
    });

    it('throws when inputs is not an array', async () => {
      await expect(client.createEmbeddings('not-an-array'))
        .to.be.rejectedWith('inputs must be a non-empty array');
    });

    it('throws when inputs is an empty array', async () => {
      await expect(client.createEmbeddings([]))
        .to.be.rejectedWith('inputs must be a non-empty array');
    });

    it('throws when an input entry is not a non-empty string', async () => {
      await expect(client.createEmbeddings(['ok', '']))
        .to.be.rejectedWith('each input must be a non-empty string');
    });

    it('returns one vector per input, in input order', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, {
          object: 'list',
          data: [
            { object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] },
            { object: 'embedding', index: 1, embedding: [0.4, 0.5, 0.6] },
          ],
          model: 'text-embedding-3-small',
        });

      const result = await client.createEmbeddings(['topic a', 'topic b']);
      expect(result).to.deep.equal([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    });

    it('re-sorts out-of-order response data by input index', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, {
          data: [
            { index: 1, embedding: [0.4, 0.5] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        });

      const result = await client.createEmbeddings(['first', 'second']);
      expect(result).to.deep.equal([[0.1, 0.2], [0.4, 0.5]]);
    });

    it('forwards the dimensions option in the request body', async () => {
      let capturedBody;
      const capture = (body) => {
        capturedBody = body;
        return true;
      };
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path, capture)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, { data: [{ index: 0, embedding: [0.1] }] });

      await client.createEmbeddings(['x'], { dimensions: 256 });
      expect(capturedBody).to.deep.equal({ input: ['x'], dimensions: 256 });
    });

    it('omits dimensions from the body when not provided (null options)', async () => {
      let capturedBody;
      const capture = (body) => {
        capturedBody = body;
        return true;
      };
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path, capture)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, { data: [{ index: 0, embedding: [0.1] }] });

      await client.createEmbeddings(['x'], null);
      expect(capturedBody).to.deep.equal({ input: ['x'] });
    });

    it('throws on a non-2xx response', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(429, 'Too Many Requests');

      await expect(client.createEmbeddings(['x']))
        .to.be.rejectedWith('API call failed with status code 429');
      expect(mockLog.error.called).to.equal(true);
    });

    it('throws when the response has no data array', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, { object: 'list' });

      await expect(client.createEmbeddings(['x']))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('throws when the data length does not match the input count', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, { data: [{ index: 0, embedding: [0.1] }] });

      await expect(client.createEmbeddings(['x', 'y']))
        .to.be.rejectedWith('Invalid response format.');
    });

    it('throws when an embedding is not a non-empty array', async () => {
      nock(mockContext.env.AZURE_EMBEDDING_ENDPOINT)
        .post(path)
        .query({ 'api-version': '2024-02-01' })
        .reply(200, { data: [{ index: 0, embedding: [] }] });

      await expect(client.createEmbeddings(['x']))
        .to.be.rejectedWith('Invalid response format.');
    });
  });
});
