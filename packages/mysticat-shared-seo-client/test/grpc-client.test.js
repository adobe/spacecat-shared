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
import sinon from 'sinon';
import nock from 'nock';
import {
  getAccessToken,
  getGrpcClients,
  resetGrpcClients,
  createAuthInterceptor,
  fetchTopicHashMap,
  fetchGapPrompts,
} from '../src/grpc-client.js';

use(chaiAsPromised);

const TOKEN_URL = 'https://api.semrush.com';
const TOKEN_PATH = '/apis/v4-raw/auth/v0/oauth2/access_token';

describe('Semrush gRPC client', () => {
  let sandbox;

  const baseEnv = {
    SEO_CLIENT_ID: 'test-client-id',
    SEO_CLIENT_SECRET: 'test-client-secret',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetGrpcClients();
    nock.cleanAll();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
    resetGrpcClients();
  });

  describe('getAccessToken', () => {
    it('returns access_token on success', async () => {
      nock(TOKEN_URL).post(TOKEN_PATH).reply(200, { access_token: 'tok-abc' });
      const token = await getAccessToken(baseEnv);
      expect(token).to.equal('tok-abc');
    });

    it('throws when SEO_CLIENT_ID is missing', async () => {
      await expect(getAccessToken({ SEO_CLIENT_SECRET: 'secret' }))
        .to.be.rejectedWith('SEO_CLIENT_ID and SEO_CLIENT_SECRET must be set');
    });

    it('throws when SEO_CLIENT_SECRET is missing', async () => {
      await expect(getAccessToken({ SEO_CLIENT_ID: 'id' }))
        .to.be.rejectedWith('SEO_CLIENT_ID and SEO_CLIENT_SECRET must be set');
    });

    it('throws when token response has no access_token', async () => {
      nock(TOKEN_URL).post(TOKEN_PATH).reply(401, { error: 'invalid_client' });
      await expect(getAccessToken(baseEnv))
        .to.be.rejectedWith('Semrush OAuth token request failed');
    });

    it('uses custom SEO_OAUTH_TOKEN_URL when provided', async () => {
      const customUrl = 'https://custom.auth.example.com';
      nock(customUrl).post('/token').reply(200, { access_token: 'custom-tok' });
      const token = await getAccessToken({ ...baseEnv, SEO_OAUTH_TOKEN_URL: `${customUrl}/token` });
      expect(token).to.equal('custom-tok');
    });

    it('uses custom SEO_OAUTH_SCOPES when provided', async () => {
      let capturedBody;
      nock(TOKEN_URL)
        .post(TOKEN_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, { access_token: 'tok-scoped' });
      await getAccessToken({ ...baseEnv, SEO_OAUTH_SCOPES: 'ai-seo.topics' });
      expect(capturedBody).to.include('ai-seo.topics');
    });
  });

  describe('getGrpcClients', () => {
    it('returns all expected clients', () => {
      const clients = getGrpcClients(baseEnv);
      expect(clients).to.have.all.keys(
        'brandClient',
        'topicClient',
        'promptClient',
        'sourceClient',
        'competitorClient',
        'crMetricsClient',
        'crMetaClient',
        'voSourcesClient',
        'prRelationsClient',
      );
    });

    it('returns the same singleton on subsequent calls', () => {
      const first = getGrpcClients(baseEnv);
      const second = getGrpcClients(baseEnv);
      expect(first).to.equal(second);
    });

    it('creates a new instance after resetGrpcClients', () => {
      const first = getGrpcClients(baseEnv);
      resetGrpcClients();
      const second = getGrpcClients(baseEnv);
      expect(first).to.not.equal(second);
    });
  });

  describe('createAuthInterceptor', () => {
    it('sets Bearer authorization header on each request', async () => {
      nock(TOKEN_URL).post(TOKEN_PATH).reply(200, { access_token: 'bearer-tok' });
      const mockReq = { header: { set: sandbox.stub() } };
      const mockNext = sandbox.stub().resolves('response');

      const interceptor = createAuthInterceptor(baseEnv);
      const result = await interceptor(mockNext)(mockReq);

      expect(mockReq.header.set.calledWith('authorization', 'Bearer bearer-tok')).to.be.true;
      expect(result).to.equal('response');
    });
  });

  describe('fetchTopicHashMap', () => {
    it('returns a Map of topic name to topicHash', async () => {
      const mockTopicClient = {
        brandTopics: sandbox.stub().resolves({
          topics: [
            { topic: 'cloud security', topicHash: '12345' },
            { topic: 'zero trust', topicHash: '67890' },
          ],
        }),
      };

      const map = await fetchTopicHashMap(mockTopicClient, 'example.com');
      expect(map.get('cloud security')).to.equal('12345');
      expect(map.get('zero trust')).to.equal('67890');
    });

    it('handles empty topics response', async () => {
      const mockTopicClient = {
        brandTopics: sandbox.stub().resolves({ topics: [] }),
      };
      const map = await fetchTopicHashMap(mockTopicClient, 'example.com');
      expect(map.size).to.equal(0);
    });

    it('lowercases topic names in the map', async () => {
      const mockTopicClient = {
        brandTopics: sandbox.stub().resolves({
          topics: [{ topic: 'Cloud Security', topicHash: '111' }],
        }),
      };
      const map = await fetchTopicHashMap(mockTopicClient, 'example.com');
      expect(map.get('cloud security')).to.equal('111');
      expect(map.has('Cloud Security')).to.be.false;
    });

    it('skips entries missing topic or topicHash', async () => {
      const mockTopicClient = {
        brandTopics: sandbox.stub().resolves({
          topics: [
            { topic: 'valid', topicHash: '999' },
            { topic: '', topicHash: '000' },
            { topic: 'no-hash', topicHash: '' },
          ],
        }),
      };
      const map = await fetchTopicHashMap(mockTopicClient, 'example.com');
      expect(map.size).to.equal(1);
      expect(map.get('valid')).to.equal('999');
    });
  });

  describe('fetchGapPrompts', () => {
    it('returns gap prompts array', async () => {
      const mockPrompts = [{ prompt: 'what is zero trust?' }, { prompt: 'best cloud security' }];
      const mockPromptClient = {
        gapPrompts: sandbox.stub().resolves({ prompts: mockPrompts }),
      };

      const prompts = await fetchGapPrompts(mockPromptClient, '12345', 'example.com');
      expect(prompts).to.deep.equal(mockPrompts);
    });

    it('returns empty array when prompts is missing', async () => {
      const mockPromptClient = {
        gapPrompts: sandbox.stub().resolves({}),
      };
      const prompts = await fetchGapPrompts(mockPromptClient, '12345', 'example.com');
      expect(prompts).to.deep.equal([]);
    });
  });
});
