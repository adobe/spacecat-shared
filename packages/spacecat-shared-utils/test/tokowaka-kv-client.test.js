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

/* eslint-env mocha */

import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';
import { TokowakaKVClient } from '../src/tokowaka-kv-client.js';

describe('TokowakaKVClient', () => {
  let sandbox;
  let log;
  let env;

  const FASTLY_KV_API_BASE = 'https://api.fastly.com/resources/stores/kv';
  const TEST_STORE_ID = 'test-store-id';
  const TEST_API_TOKEN = 'test-api-token';

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    log = {
      debug: sandbox.spy(),
      info: sandbox.spy(),
      warn: sandbox.spy(),
      error: sandbox.spy(),
    };
    env = {
      FASTLY_KV_STORE_ID: TEST_STORE_ID,
      FASTLY_API_TOKEN: TEST_API_TOKEN,
    };
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('should create a client with valid configuration', () => {
      const client = new TokowakaKVClient(env, log);
      expect(client.storeId).to.equal(TEST_STORE_ID);
      expect(client.apiToken).to.equal(TEST_API_TOKEN);
    });

    it('should throw error if FASTLY_KV_STORE_ID is missing', () => {
      delete env.FASTLY_KV_STORE_ID;
      expect(() => new TokowakaKVClient(env, log)).to.throw('FASTLY_KV_STORE_ID environment variable is required');
    });

    it('should throw error if FASTLY_API_TOKEN is missing', () => {
      delete env.FASTLY_API_TOKEN;
      expect(() => new TokowakaKVClient(env, log)).to.throw('FASTLY_API_TOKEN environment variable is required');
    });

    it('should throw error if env is null', () => {
      expect(() => new TokowakaKVClient(null, log)).to.throw('FASTLY_KV_STORE_ID environment variable is required');
    });
  });

  describe('listAllStaleKeys', () => {
    it('should fetch all pages of stale keys', async () => {
      const client = new TokowakaKVClient(env, log);
      const keysPage1 = ['sugg-1'];
      const keysPage2 = ['sugg-2'];
      const staleValue = { url: 'https://example.com', status: 'stale' };

      // Page 1
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: keysPage1, meta: { next_cursor: 'cursor-1' } });

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keysPage1[0])}`)
        .reply(200, JSON.stringify(staleValue));

      // Page 2
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100', cursor: 'cursor-1' })
        .reply(200, { data: keysPage2, meta: {} });

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keysPage2[0])}`)
        .reply(200, JSON.stringify(staleValue));

      const result = await client.listAllStaleKeys();

      expect(result).to.have.lengthOf(2);
      expect(result[0].suggestionId).to.equal('sugg-1');
      expect(result[1].suggestionId).to.equal('sugg-2');
    });

    it('should filter out non-stale keys', async () => {
      const client = new TokowakaKVClient(env, log);
      const keys = ['sugg-stale', 'sugg-live'];

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: keys, meta: {} });

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[0])}`)
        .reply(200, JSON.stringify({ url: 'https://example.com/stale', status: 'stale' }));

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[1])}`)
        .reply(200, JSON.stringify({ url: 'https://example.com/live', status: 'live' }));

      const result = await client.listAllStaleKeys();

      expect(result).to.have.lengthOf(1);
      expect(result[0].suggestionId).to.equal('sugg-stale');
      expect(result[0].url).to.equal('https://example.com/stale');
    });

    it('should respect maxPages limit', async () => {
      const client = new TokowakaKVClient(env, log);
      const staleValue = { url: 'https://example.com', status: 'stale' };

      // Always return a next cursor to simulate infinite pages
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query(true)
        .times(3)
        .reply(200, { data: ['sugg-1'], meta: { next_cursor: 'next' } });

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent('sugg-1')}`)
        .times(3)
        .reply(200, JSON.stringify(staleValue));

      const result = await client.listAllStaleKeys({ maxPages: 3 });

      expect(result).to.have.lengthOf(3);
      expect(log.warn.calledWith(sinon.match(/Reached maximum page limit/))).to.be.true;
    });

    it('should return empty array if no stale keys found', async () => {
      const client = new TokowakaKVClient(env, log);

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: [], meta: {} });

      const result = await client.listAllStaleKeys();

      expect(result).to.have.lengthOf(0);
    });

    it('should continue processing if individual key fetch fails', async () => {
      const client = new TokowakaKVClient(env, log);
      const keys = ['sugg-fail', 'sugg-success'];

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: keys, meta: {} });

      // First key fails
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[0])}`)
        .reply(500, 'Error');

      // Second key succeeds
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[1])}`)
        .reply(200, JSON.stringify({ url: 'https://example.com', status: 'stale' }));

      const result = await client.listAllStaleKeys();

      expect(result).to.have.lengthOf(1);
      expect(result[0].suggestionId).to.equal('sugg-success');
      expect(log.warn.called).to.be.true;
    });

    it('should handle non-JSON response gracefully', async () => {
      const client = new TokowakaKVClient(env, log);
      const keys = ['sugg-1'];

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: keys, meta: {} });

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[0])}`)
        .reply(200, 'plain-text-value');

      const result = await client.listAllStaleKeys();

      // Non-JSON response gets status 'unknown', which is not 'stale', so filtered out
      expect(result).to.have.lengthOf(0);
      expect(log.warn.called).to.be.true;
    });

    it('should skip keys that return 404', async () => {
      const client = new TokowakaKVClient(env, log);
      const keys = ['sugg-deleted', 'sugg-exists'];

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(200, { data: keys, meta: {} });

      // First key returns 404
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[0])}`)
        .reply(404, 'Not Found');

      // Second key exists and is stale
      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys/${encodeURIComponent(keys[1])}`)
        .reply(200, JSON.stringify({ url: 'https://example.com', status: 'stale' }));

      const result = await client.listAllStaleKeys();

      // Only the existing stale key should be returned
      expect(result).to.have.lengthOf(1);
      expect(result[0].suggestionId).to.equal('sugg-exists');
    });

    it('should throw error when listing keys fails', async () => {
      const client = new TokowakaKVClient(env, log);

      nock(FASTLY_KV_API_BASE)
        .get(`/${TEST_STORE_ID}/keys`)
        .query({ limit: '100' })
        .reply(500, 'Internal Server Error');

      try {
        await client.listAllStaleKeys();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to list keys from KV Store');
      }
    });
  });
});
