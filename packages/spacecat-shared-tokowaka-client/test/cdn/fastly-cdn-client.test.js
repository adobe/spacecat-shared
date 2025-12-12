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

import { expect } from 'chai';
import sinon from 'sinon';
import FastlyCdnClient from '../../src/cdn/fastly-cdn-client.js';

describe('FastlyCdnClient', () => {
  let log;
  let fetchStub;

  beforeEach(() => {
    log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };

    // Stub global fetch
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should throw error for invalid JSON in TOKOWAKA_CDN_CONFIG', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: 'invalid-json{',
      };

      expect(() => new FastlyCdnClient(env, log))
        .to.throw('Invalid TOKOWAKA_CDN_CONFIG: must be valid JSON');
    });

    it('should throw error if fastly config is missing', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          cloudfront: { distributionId: 'test' },
        }),
      };

      expect(() => new FastlyCdnClient(env, log))
        .to.throw("Missing 'fastly' config in TOKOWAKA_CDN_CONFIG");
    });

    it('should create client with valid config', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            apiToken: 'test-api-token',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };

      const client = new FastlyCdnClient(env, log);
      expect(client).to.be.instanceOf(FastlyCdnClient);
      expect(client.getProviderName()).to.equal('fastly');
    });
  });

  describe('validateConfig', () => {
    it('should return false if serviceId is missing', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            apiToken: 'test-api-token',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };

      const client = new FastlyCdnClient(env, log);
      expect(client.validateConfig()).to.be.false;
      expect(log.error.calledOnce).to.be.true;
    });

    it('should return false if apiToken is missing', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };

      const client = new FastlyCdnClient(env, log);
      expect(client.validateConfig()).to.be.false;
      expect(log.error.calledOnce).to.be.true;
    });

    it('should return false if distributionUrl is missing', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            apiToken: 'test-api-token',
          },
        }),
      };

      const client = new FastlyCdnClient(env, log);
      expect(client.validateConfig()).to.be.false;
      expect(log.error).to.have.been.calledWith(sinon.match(/distributionUrl/));
    });

    it('should return true with valid config', () => {
      const env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            apiToken: 'test-api-token',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };

      const client = new FastlyCdnClient(env, log);
      expect(client.validateConfig()).to.be.true;
    });
  });

  describe('invalidateCache', () => {
    let client;
    let env;

    beforeEach(() => {
      env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            apiToken: 'test-api-token',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };
      client = new FastlyCdnClient(env, log);
    });

    it('should throw error for invalid config', async () => {
      const invalidEnv = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            // missing apiToken
          },
        }),
      };
      const invalidClient = new FastlyCdnClient(invalidEnv, log);

      // Should throw error when invalidating cache with invalid config
      try {
        await invalidClient.invalidateCache(['/path1']);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Invalid Fastly CDN configuration');
      }
    });

    it('should return skipped status for empty paths', async () => {
      const result = await client.invalidateCache([]);
      expect(result.status).to.equal('skipped');
      expect(result.message).to.equal('No paths to invalidate');
      expect(log.warn.calledOnce).to.be.true;
    });

    it('should successfully purge cache for valid single path', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok', id: 'purge-123' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('success');
      expect(result.provider).to.equal('fastly');
      expect(result.serviceId).to.equal('test-service-id');
      expect(result.successCount).to.equal(1);
      expect(result.failedCount).to.equal(0);
      expect(result.totalPaths).to.equal(1);
      expect(result.purgeId).to.equal('purge-123');

      expect(fetchStub.calledOnce).to.be.true;
      const fetchCall = fetchStub.getCall(0);
      expect(fetchCall.args[0]).to.include('test-service-id');
      expect(fetchCall.args[1].method).to.equal('POST');
      expect(fetchCall.args[1].headers['Fastly-Key']).to.equal('test-api-token');
    });

    it('should use batch purge for multiple paths (legacy test)', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/opportunities/example.com/L2Fib3V0',
      ];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok', id: 'batch-purge-123' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('success');
      expect(result.totalKeys).to.equal(2);
      expect(result.successCount).to.equal(2);
      expect(result.failedCount).to.equal(0);
      // Now uses batch, so only 1 call
      expect(fetchStub.callCount).to.equal(1);
    });

    it('should handle batch failures for multiple paths', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/opportunities/example.com/L2Fib3V0',
      ];

      // With batch purge, single failure fails all
      fetchStub.resolves({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('failed');
      expect(result.totalKeys).to.equal(2);
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(2);
      expect(result.error).to.equal('Forbidden');
    });

    it('should handle network errors for single path', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.rejects(new Error('Network error'));

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('error');
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(1);
      expect(result.error).to.equal('Network error');
    });

    it('should convert paths to surrogate keys correctly in batch', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/preview/opportunities/test.com/abc123',
      ];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await client.invalidateCache(paths);

      // Now uses batch, so only 1 call
      expect(fetchStub.callCount).to.equal(1);

      // Check that surrogate keys are full CloudFront URLs (space-separated)
      const fetchCall = fetchStub.getCall(0);
      const surrogateKey = fetchCall.args[1].headers['Surrogate-Key'];
      expect(surrogateKey).to.include('https://test.cloudfront.net/opportunities/example.com/L3Byb2R1Y3Rz');
      expect(surrogateKey).to.include('https://test.cloudfront.net/preview/opportunities/test.com/abc123');
    });

    it('should normalize paths without leading slash (line 78)', async () => {
      const paths = [
        'opportunities/example.com/config', // No leading slash - tests line 78
      ];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok', id: 'normalize-test' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('success');

      // Check that path was normalized with leading slash
      const fetchCall = fetchStub.getCall(0);
      const surrogateKey = fetchCall.args[1].headers['Surrogate-Key'];
      expect(surrogateKey).to.equal('https://test.cloudfront.net/opportunities/example.com/config');
    });

    it('should include duration in result for single path', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.duration).to.be.a('number');
      expect(result.duration).to.be.greaterThanOrEqual(0);
    });

    it('should handle errors during result processing', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      // Create a response that will throw during json() call
      fetchStub.resolves({
        ok: true,
        json: async () => {
          throw new Error('JSON parsing error');
        },
      });

      const result = await client.invalidateCache(paths);

      // Should catch the error and add it to results
      expect(result.status).to.equal('error');
      expect(result.failedCount).to.equal(1);
      expect(result.error).to.equal('JSON parsing error');
    });
  });

  describe('unified purging (single endpoint for all cases)', () => {
    let client;
    let env;

    beforeEach(() => {
      env = {
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          fastly: {
            serviceId: 'test-service-id',
            apiToken: 'test-api-token',
            distributionUrl: 'https://test.cloudfront.net',
          },
        }),
      };
      client = new FastlyCdnClient(env, log);
    });

    it('should use batch endpoint for multiple paths', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/opportunities/example.com/L2Fib3V0',
        '/opportunities/example.com/L2NvbnRhY3Q',
      ];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok', id: 'batch-purge-123' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('success');
      expect(result.provider).to.equal('fastly');
      expect(result.totalKeys).to.equal(3);
      expect(result.successCount).to.equal(3);
      expect(result.failedCount).to.equal(0);
      expect(result.purgeId).to.equal('batch-purge-123');

      // Should make only ONE API call for batch
      expect(fetchStub.calledOnce).to.be.true;

      // Check that it used the batch endpoint
      const fetchCall = fetchStub.getCall(0);
      expect(fetchCall.args[0]).to.equal('https://api.fastly.com/service/test-service-id/purge');

      // Check that surrogate keys are full CloudFront URLs (space-separated)
      const { headers } = fetchCall.args[1];
      expect(headers['Surrogate-Key']).to.be.a('string');
      const keys = headers['Surrogate-Key'].split(' ');
      expect(keys).to.have.lengthOf(3);
      expect(headers['Surrogate-Key']).to.include('https://test.cloudfront.net/opportunities/example.com/');
    });

    it('should handle batch purge failures', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/opportunities/example.com/L2Fib3V0',
      ];

      fetchStub.resolves({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('failed');
      expect(result.totalKeys).to.equal(2);
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(2);
      expect(result.error).to.equal('Forbidden');
    });

    it('should handle batch purge network errors', async () => {
      const paths = [
        '/opportunities/example.com/L3Byb2R1Y3Rz',
        '/opportunities/example.com/L2Fib3V0',
      ];

      fetchStub.rejects(new Error('Network timeout'));

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('error');
      expect(result.totalKeys).to.equal(2);
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(2);
      expect(result.error).to.equal('Network timeout');
    });

    it('should use batch endpoint for single path too', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.resolves({
        ok: true,
        json: async () => ({ status: 'ok', id: 'purge-123' }),
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('success');
      expect(result.totalKeys).to.equal(1);
      expect(result.successCount).to.equal(1);
      expect(result.failedCount).to.equal(0);
      expect(result.purgeId).to.equal('purge-123');

      // Should use batch endpoint even for single path (consistent behavior)
      const fetchCall = fetchStub.getCall(0);
      expect(fetchCall.args[0]).to.equal('https://api.fastly.com/service/test-service-id/purge');
      expect(fetchCall.args[1].headers['Surrogate-Key']).to.equal('https://test.cloudfront.net/opportunities/example.com/L3Byb2R1Y3Rz');
    });

    it('should handle single path purge failure', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.resolves({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('failed');
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(1);
      expect(result.error).to.equal('Forbidden');
    });

    it('should handle single path network error', async () => {
      const paths = ['/opportunities/example.com/L3Byb2R1Y3Rz'];

      fetchStub.rejects(new Error('Network timeout'));

      const result = await client.invalidateCache(paths);

      expect(result.status).to.equal('error');
      expect(result.successCount).to.equal(0);
      expect(result.failedCount).to.equal(1);
      expect(result.error).to.equal('Network timeout');
    });
  });
});
