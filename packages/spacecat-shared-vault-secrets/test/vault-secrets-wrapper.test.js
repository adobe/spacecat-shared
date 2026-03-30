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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';
import vaultSecrets, { loadSecrets, reset } from '../src/vault-secrets-wrapper.js';

use(chaiAsPromised);

const VAULT_ADDR = 'https://vault-test.example.com';
const MOUNT_POINT = 'dx_mysticat';
const REGION = 'us-east-1';
const AWS_ENDPOINT = `https://secretsmanager.${REGION}.amazonaws.com`;
const BOOTSTRAP_PATH = '/mysticat/vault-bootstrap';

const bootstrapConfig = {
  role_id: 'test-role-id',
  secret_id: 'test-secret-id',
  vault_addr: VAULT_ADDR,
  mount_point: MOUNT_POINT,
  environment: 'prod',
};

const testSecrets = {
  SLACK_BOT_TOKEN: 'xoxb-test',
  IMS_CLIENT_ID: 'test-client-id',
  IMS_CLIENT_SECRET: 'test-client-secret',
};

function mockBootstrap() {
  return nock(AWS_ENDPOINT)
    .post('/', (body) => {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      return str.includes(BOOTSTRAP_PATH);
    })
    .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });
}

function mockAppRoleLogin() {
  return nock(VAULT_ADDR)
    .post('/v1/auth/approle/login')
    .reply(200, {
      auth: { client_token: 'test-vault-token', lease_duration: 3600, renewable: true },
    });
}

function mockSecretRead(path = 'prod/api-service') {
  return nock(VAULT_ADDR)
    .get(`/v1/${MOUNT_POINT}/data/${path}`)
    .reply(200, {
      data: {
        data: testSecrets,
        metadata: { version: 1, created_time: '2026-01-01T00:00:00Z' },
      },
    });
}

function mockMetadataRead(path = 'prod/api-service', updatedTime = '2026-01-01T00:00:00Z') {
  return nock(VAULT_ADDR)
    .get(`/v1/${MOUNT_POINT}/metadata/${path}`)
    .reply(200, {
      data: { updated_time: updatedTime, current_version: 1 },
    });
}

function makeContext(overrides = {}) {
  return {
    runtime: { name: 'aws-lambda' },
    func: {
      name: 'api-service',
      package: 'spacecat-services',
      version: '4.2.1',
    },
    env: {},
    log: { info: sinon.stub(), warn: sinon.stub(), error: sinon.stub() },
    ...overrides,
  };
}

describe('vaultSecrets wrapper', () => {
  const savedEnv = {};

  beforeEach(() => {
    reset();
    savedEnv.AWS_REGION = process.env.AWS_REGION;
    savedEnv.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    savedEnv.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
    savedEnv.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;

    process.env.AWS_REGION = REGION;
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.AWS_SESSION_TOKEN = 'test-session-token';
  });

  afterEach(() => {
    reset();
    sinon.restore();
    nock.cleanAll();
    process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

    // Restore original env vars
    Object.entries(savedEnv).forEach(([key, val]) => {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    });

    // Clean up any test secrets leaked into process.env
    Object.keys(testSecrets).forEach((key) => {
      delete process.env[key];
    });
    delete process.env.NEW_KEY;
  });

  describe('middleware wrapper', () => {
    it('loads secrets and merges into context.env', async () => {
      const bootstrap = mockBootstrap();
      const login = mockAppRoleLogin();
      const read = mockSecretRead();

      const ctx = makeContext();
      const innerFn = sinon.stub().resolves(new Response('ok'));
      const wrapped = vaultSecrets(innerFn, { bootstrapPath: BOOTSTRAP_PATH });

      const request = new Request('https://example.com');
      await wrapped(request, ctx);

      expect(ctx.env.SLACK_BOT_TOKEN).to.equal('xoxb-test');
      expect(ctx.env.IMS_CLIENT_ID).to.equal('test-client-id');
      expect(ctx.env.IMS_CLIENT_SECRET).to.equal('test-client-secret');
      expect(innerFn.calledOnce).to.equal(true);
      expect(bootstrap.isDone()).to.equal(true);
      expect(login.isDone()).to.equal(true);
      expect(read.isDone()).to.equal(true);
    });

    it('merges secrets into process.env', async () => {
      mockBootstrap();
      mockAppRoleLogin();
      mockSecretRead();

      const ctx = makeContext();
      const innerFn = sinon.stub().resolves(new Response('ok'));
      const wrapped = vaultSecrets(innerFn, { bootstrapPath: BOOTSTRAP_PATH });

      await wrapped(new Request('https://example.com'), ctx);

      expect(process.env.SLACK_BOT_TOKEN).to.equal('xoxb-test');
      expect(process.env.IMS_CLIENT_ID).to.equal('test-client-id');
    });

    it('returns 502 on error (bootstrap fails)', async () => {
      nock(AWS_ENDPOINT)
        .post('/')
        .replyWithError('connection refused');

      const ctx = makeContext();
      const innerFn = sinon.stub().resolves(new Response('ok'));
      const wrapped = vaultSecrets(innerFn, { bootstrapPath: BOOTSTRAP_PATH });

      const response = await wrapped(new Request('https://example.com'), ctx);

      expect(response.status).to.equal(502);
      expect(response.headers.get('x-error')).to.equal('error fetching secrets.');
      expect(innerFn.called).to.equal(false);
    });

    it('returns empty object when VAULT_SECRETS_DISABLED is true', async () => {
      process.env.VAULT_SECRETS_DISABLED = 'true';
      const ctx = makeContext();
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal({});
      delete process.env.VAULT_SECRETS_DISABLED;
    });

    it('returns empty object on simulate runtime (skips Vault)', async () => {
      const ctx = makeContext({ runtime: { name: 'simulate' } });
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal({});
    });

    it('returns empty object when no ctx.func', async () => {
      const ctx = makeContext({ func: undefined });
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal({});
    });

    it('concurrent calls share a single bootstrap (lock)', async () => {
      mockBootstrap();
      mockAppRoleLogin();
      // Both calls will try to read the secret (lock only protects ensureClient)
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/prod/api-service`)
        .times(2)
        .reply(200, {
          data: {
            data: testSecrets,
            metadata: { version: 1, created_time: '2026-01-01T00:00:00Z' },
          },
        });

      const ctx1 = makeContext();
      const ctx2 = makeContext();

      // Both calls start concurrently - only one bootstrap/login should fire
      const [result1, result2] = await Promise.all([
        loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH }),
        loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH }),
      ]);

      expect(result1).to.deep.equal(testSecrets);
      expect(result2).to.deep.equal(testSecrets);
    });

    it('concurrent waiter gets error when bootstrap fails', async () => {
      nock(AWS_ENDPOINT)
        .post('/')
        .replyWithError('connection refused');

      const ctx1 = makeContext();
      const ctx2 = makeContext();

      const results = await Promise.allSettled([
        loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH }),
        loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH }),
      ]);

      // Both calls should fail - first from bootstrap error, second from lock check
      expect(results[0].status).to.equal('rejected');
      expect(results[1].status).to.equal('rejected');
    });
  });

  describe('caching', () => {
    it('caches secrets across invocations', async () => {
      mockBootstrap();
      mockAppRoleLogin();
      mockSecretRead();

      const ctx1 = makeContext();
      const result1 = await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result1).to.deep.equal(testSecrets);

      // Second call - no new nock mocks needed, should use cache
      const ctx2 = makeContext();
      const result2 = await loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result2).to.deep.equal(testSecrets);
    });

    it('re-fetches after expiration', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        const result1 = await loadSecrets(ctx1, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000, // 1 second
        });
        expect(result1).to.deep.equal(testSecrets);

        // Advance past expiration
        clock.tick(2000);

        // Need new secret read mock for re-fetch
        const updatedSecrets = { ...testSecrets, NEW_KEY: 'new-value' };
        nock(VAULT_ADDR)
          .get(`/v1/${MOUNT_POINT}/data/prod/api-service`)
          .reply(200, {
            data: {
              data: updatedSecrets,
              metadata: { version: 2, created_time: '2026-01-02T00:00:00Z' },
            },
          });

        const ctx2 = makeContext();
        const result2 = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        });
        expect(result2).to.deep.equal(updatedSecrets);
      } finally {
        clock.restore();
      }
    });

    it('checks metadata after check delay', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, {
          bootstrapPath: BOOTSTRAP_PATH,
          checkDelay: 500,
          expiration: 60000,
        });

        // Advance past check delay but not expiration
        clock.tick(1000);

        // Mock metadata - lastChanged is 0 (initial), same updated_time means no re-fetch
        mockMetadataRead();

        const ctx2 = makeContext();
        const result2 = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          checkDelay: 500,
          expiration: 60000,
        });
        expect(result2).to.deep.equal(testSecrets);
      } finally {
        clock.restore();
      }
    });

    it('re-fetches when metadata shows change', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, {
          bootstrapPath: BOOTSTRAP_PATH,
          checkDelay: 500,
          expiration: 60000,
        });

        // Phase 1: First metadata check establishes baseline (lastChanged was 0)
        clock.tick(1000);
        mockMetadataRead('prod/api-service', '2026-01-01T00:00:00Z');

        const ctx2 = makeContext();
        const result2 = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          checkDelay: 500,
          expiration: 60000,
        });
        // Should return cached data (baseline established, no re-fetch)
        expect(result2).to.deep.equal(testSecrets);

        // Phase 2: Second metadata check detects actual change
        clock.tick(1000);
        mockMetadataRead('prod/api-service', '2026-02-01T00:00:00Z');

        const updatedSecrets = { ...testSecrets, ROTATED: 'yes' };
        nock(VAULT_ADDR)
          .get(`/v1/${MOUNT_POINT}/data/prod/api-service`)
          .reply(200, {
            data: {
              data: updatedSecrets,
              metadata: { version: 2, created_time: '2026-02-01T00:00:00Z' },
            },
          });

        const ctx3 = makeContext();
        const result3 = await loadSecrets(ctx3, {
          bootstrapPath: BOOTSTRAP_PATH,
          checkDelay: 500,
          expiration: 60000,
        });
        expect(result3).to.deep.equal(updatedSecrets);
      } finally {
        clock.restore();
      }
    });

    it('reset() clears cache', async () => {
      mockBootstrap();
      mockAppRoleLogin();
      mockSecretRead();

      const ctx1 = makeContext();
      await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

      reset();

      // After reset, need fresh mocks for bootstrap + login + read
      mockBootstrap();
      mockAppRoleLogin();
      mockSecretRead();

      const ctx2 = makeContext();
      const result = await loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result).to.deep.equal(testSecrets);
    });
  });

  describe('path resolution', () => {
    it('uses convention-based path: {env}/{service}', async () => {
      mockBootstrap();
      mockAppRoleLogin();

      // The path should be prod/api-service (from bootstrap env + func.name)
      const read = mockSecretRead('prod/api-service');

      const ctx = makeContext();
      await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(read.isDone()).to.equal(true);
    });

    it('uses custom name function if provided', async () => {
      mockBootstrap();
      mockAppRoleLogin();

      const customPath = 'custom/secret/path';
      const read = mockSecretRead(customPath);

      const ctx = makeContext();
      await loadSecrets(ctx, {
        bootstrapPath: BOOTSTRAP_PATH,
        name: () => customPath,
      });

      expect(read.isDone()).to.equal(true);
    });

    it('uses custom name string if provided', async () => {
      mockBootstrap();
      mockAppRoleLogin();

      const customPath = 'string/secret/path';
      const read = mockSecretRead(customPath);

      const ctx = makeContext();
      await loadSecrets(ctx, {
        bootstrapPath: BOOTSTRAP_PATH,
        name: customPath,
      });

      expect(read.isDone()).to.equal(true);
    });

    it('falls back to convention if name function throws', async () => {
      mockBootstrap();
      mockAppRoleLogin();

      // Should fall back to default path
      const read = mockSecretRead('prod/api-service');

      const ctx = makeContext();
      await loadSecrets(ctx, {
        bootstrapPath: BOOTSTRAP_PATH,
        name: () => { throw new Error('custom name failed'); },
      });

      expect(read.isDone()).to.equal(true);
    });
  });

  describe('bootstrap path resolution', () => {
    it('auto-resolves bootstrapPath from ctx.func.name when not provided', async () => {
      // Should use /mysticat/bootstrap/api-service (from ctx.func.name)
      const bootstrap = nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes('/mysticat/bootstrap/api-service');
        })
        .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });
      const login = mockAppRoleLogin();
      const read = mockSecretRead();

      const ctx = makeContext();
      // No bootstrapPath option - should auto-resolve
      const result = await loadSecrets(ctx);

      expect(result).to.deep.equal(testSecrets);
      expect(bootstrap.isDone()).to.equal(true);
      expect(login.isDone()).to.equal(true);
      expect(read.isDone()).to.equal(true);
    });

    it('explicit bootstrapPath overrides auto-resolution', async () => {
      const customPath = '/custom/bootstrap/path';
      const bootstrap = nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes(customPath);
        })
        .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });
      const login = mockAppRoleLogin();
      const read = mockSecretRead();

      const ctx = makeContext();
      const result = await loadSecrets(ctx, { bootstrapPath: customPath });

      expect(result).to.deep.equal(testSecrets);
      expect(bootstrap.isDone()).to.equal(true);
      expect(login.isDone()).to.equal(true);
      expect(read.isDone()).to.equal(true);
    });

    it('auto-resolves different service names correctly', async () => {
      const bootstrap = nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes('/mysticat/bootstrap/audit-worker');
        })
        .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });
      const login = mockAppRoleLogin();
      const read = mockSecretRead('prod/audit-worker');

      const ctx = makeContext({ func: { name: 'audit-worker' } });
      const result = await loadSecrets(ctx);

      expect(result).to.deep.equal(testSecrets);
      expect(bootstrap.isDone()).to.equal(true);
      expect(login.isDone()).to.equal(true);
      expect(read.isDone()).to.equal(true);
    });
  });

  describe('dev alias overrides', () => {
    const devBootstrapConfig = { ...bootstrapConfig, environment: 'dev' };

    function mockDevBootstrap() {
      return nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes(BOOTSTRAP_PATH);
        })
        .reply(200, { SecretString: JSON.stringify(devBootstrapConfig) });
    }

    function mockDevSecretRead(path = 'dev/api-service') {
      return nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/${path}`)
        .reply(200, {
          data: {
            data: testSecrets,
            metadata: { version: 1, created_time: '2026-01-01T00:00:00Z' },
          },
        });
    }

    function mockOverrideRead(alias, overrides) {
      return nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/dev/development/api-service/${alias}`)
        .reply(200, {
          data: {
            data: overrides,
            metadata: { version: 1 },
          },
        });
    }

    function mockOverride404(alias) {
      return nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/dev/development/api-service/${alias}`)
        .reply(404, { errors: [] });
    }

    function makeDevContext(version = 'djc', overrides = {}) {
      return makeContext({
        func: {
          name: 'api-service',
          package: 'spacecat-services',
          version,
          ...overrides,
        },
      });
    }

    it('merges overrides when dev env + developer alias + overrides exist', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      const overrides = { IMS_CLIENT_ID: 'override-id', CUSTOM_KEY: 'custom-val' };
      mockOverrideRead('djc', overrides);

      const ctx = makeDevContext('djc');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal({
        ...testSecrets,
        ...overrides,
      });
      expect(ctx.log.info.calledWithMatch(/Loaded dev overrides/)).to.equal(true);
    });

    it('returns base secrets when override path returns 404', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      mockOverride404('djc');

      const ctx = makeDevContext('djc');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
      expect(ctx.log.warn.called).to.equal(false);
    });

    it('does not attempt overrides for latest alias', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('latest');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides for $LATEST alias', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('$LATEST');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides in prod environment', async () => {
      mockBootstrap(); // prod bootstrap
      mockAppRoleLogin();
      mockSecretRead(); // prod/api-service

      const ctx = makeContext({
        func: { name: 'api-service', package: 'spacecat-services', version: 'djc' },
      });
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides in stage environment', async () => {
      const stageBootstrapConfig = { ...bootstrapConfig, environment: 'stage' };
      nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes(BOOTSTRAP_PATH);
        })
        .reply(200, { SecretString: JSON.stringify(stageBootstrapConfig) });
      mockAppRoleLogin();
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/stage/api-service`)
        .reply(200, {
          data: {
            data: testSecrets,
            metadata: { version: 1, created_time: '2026-01-01T00:00:00Z' },
          },
        });

      const ctx = makeContext({
        func: { name: 'api-service', package: 'spacecat-services', version: 'djc' },
      });
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides when no version field', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeContext({
        func: { name: 'api-service', package: 'spacecat-services' },
      });
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides for empty string version', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides for CI alias (ci123)', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('ci123');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('does not attempt overrides for uppercase CI alias (CI42)', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('CI42');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });

    it('merges correctly — overrides matching keys, preserves others, adds new', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      const overrides = { IMS_CLIENT_ID: 'overridden', NEW_KEY: 'new-value' };
      mockOverrideRead('djc', overrides);

      const ctx = makeDevContext('djc');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result.IMS_CLIENT_ID).to.equal('overridden');
      expect(result.SLACK_BOT_TOKEN).to.equal('xoxb-test');
      expect(result.IMS_CLIENT_SECRET).to.equal('test-client-secret');
      expect(result.NEW_KEY).to.equal('new-value');
    });

    it('does not mutate base cache — second call without override returns original base', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      const overrides = { IMS_CLIENT_ID: 'overridden' };
      mockOverrideRead('djc', overrides);

      const ctx1 = makeDevContext('djc');
      const result1 = await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result1.IMS_CLIENT_ID).to.equal('overridden');

      // Reset and reload in prod env — base cache is cleared, no override
      reset();
      mockBootstrap(); // prod
      mockAppRoleLogin();
      mockSecretRead(); // prod/api-service

      const ctx2 = makeContext();
      const result2 = await loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result2.IMS_CLIENT_ID).to.equal('test-client-id');
    });

    it('caches overrides with base — second call returns merged from cache', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      const overrides = { IMS_CLIENT_ID: 'cached-override' };
      mockOverrideRead('djc', overrides);

      const ctx1 = makeDevContext('djc');
      const result1 = await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result1.IMS_CLIENT_ID).to.equal('cached-override');

      // Second call — no new nock mocks needed, should use cache
      const ctx2 = makeDevContext('djc');
      const result2 = await loadSecrets(ctx2, { bootstrapPath: BOOTSTRAP_PATH });
      expect(result2.IMS_CLIENT_ID).to.equal('cached-override');
      expect(result2.SLACK_BOT_TOKEN).to.equal('xoxb-test');
    });

    it('logs warning and returns base secrets on non-404 override error', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/dev/development/api-service/djc`)
        .reply(403, { errors: ['permission denied'] });

      const ctx = makeDevContext('djc');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
      expect(ctx.log.warn.calledWithMatch(/Failed to load dev overrides/)).to.equal(true);
    });

    it('uses convention path even when custom opts.name is provided', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      // Custom name resolves for base secrets
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/custom/path`)
        .reply(200, {
          data: {
            data: testSecrets,
            metadata: { version: 1, created_time: '2026-01-01T00:00:00Z' },
          },
        });
      // Override path still uses convention: dev/development/api-service/djc
      const overrides = { CUSTOM: 'override' };
      mockOverrideRead('djc', overrides);

      const ctx = makeDevContext('djc');
      const result = await loadSecrets(ctx, {
        bootstrapPath: BOOTSTRAP_PATH,
        name: 'custom/path',
      });

      expect(result).to.deep.equal({ ...testSecrets, ...overrides });
    });

    it('does not attempt overrides for invalid alias format', async () => {
      mockDevBootstrap();
      mockAppRoleLogin();
      mockDevSecretRead();

      const ctx = makeDevContext('../../../etc');
      const result = await loadSecrets(ctx, { bootstrapPath: BOOTSTRAP_PATH });

      expect(result).to.deep.equal(testSecrets);
    });
  });

  describe('token lifecycle', () => {
    it('re-authenticates when token expired', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

        // Advance past token expiry (3600s lease)
        clock.tick(3601 * 1000);

        // Client exists but token expired - re-auth with cached bootstrap
        mockAppRoleLogin();
        mockSecretRead();

        const ctx2 = makeContext();
        // Use short expiration so cache also expires
        const result = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        });
        expect(result).to.deep.equal(testSecrets);
      } finally {
        clock.restore();
      }
    });

    it('renews token when expiring soon', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

        // Advance to within 5-min buffer of token expiry (3600s - 240s = 3360s)
        clock.tick(3360 * 1000);

        // Mock token renewal
        nock(VAULT_ADDR)
          .post('/v1/auth/token/renew-self')
          .reply(200, {
            auth: { client_token: 'test-vault-token', lease_duration: 3600, renewable: true },
          });

        // Cache expired, so need new secret read
        mockSecretRead();

        const ctx2 = makeContext();
        const result = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        });
        expect(result).to.deep.equal(testSecrets);
      } finally {
        clock.restore();
      }
    });

    it('re-fetches bootstrap config when re-auth fails (secret_id rotated)', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

        // Advance past token expiry
        clock.tick(3601 * 1000);

        // First re-auth attempt fails (secret_id was rotated)
        nock(VAULT_ADDR)
          .post('/v1/auth/approle/login')
          .reply(403, { errors: ['invalid secret id'] });

        // Wrapper re-fetches bootstrap with new secret_id
        const rotatedConfig = { ...bootstrapConfig, secret_id: 'rotated-secret-id' };
        nock(AWS_ENDPOINT)
          .post('/', (body) => {
            const str = typeof body === 'string' ? body : JSON.stringify(body);
            return str.includes(BOOTSTRAP_PATH);
          })
          .reply(200, { SecretString: JSON.stringify(rotatedConfig) });

        // Second auth attempt succeeds with fresh creds
        mockAppRoleLogin();
        mockSecretRead();

        const ctx2 = makeContext();
        const result = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        });
        expect(result).to.deep.equal(testSecrets);
      } finally {
        clock.restore();
      }
    });

    it('throws when both re-auth and bootstrap re-fetch fail', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

        // Advance past token expiry
        clock.tick(3601 * 1000);

        // First re-auth attempt fails
        nock(VAULT_ADDR)
          .post('/v1/auth/approle/login')
          .reply(403, { errors: ['invalid secret id'] });

        // Bootstrap re-fetch also fails
        nock(AWS_ENDPOINT)
          .post('/')
          .replyWithError('SM unavailable');

        const ctx2 = makeContext();
        await expect(loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        })).to.be.rejected;
      } finally {
        clock.restore();
      }
    });

    it('re-authenticates when renewal fails', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

      try {
        mockBootstrap();
        mockAppRoleLogin();
        mockSecretRead();

        const ctx1 = makeContext();
        await loadSecrets(ctx1, { bootstrapPath: BOOTSTRAP_PATH });

        // Advance to 1s before token expiry so isTokenExpiringSoon is true
        // but after renewal fails, token will expire from time advancement
        clock.tick(3360 * 1000);

        // Mock token renewal failure (silent)
        nock(VAULT_ADDR)
          .post('/v1/auth/token/renew-self')
          .reply(403, { errors: ['permission denied'] });

        // Token still valid after failed renewal but expiring soon
        // Advance past actual expiry
        clock.tick(241 * 1000);

        // Now token expired - re-auth with cached bootstrap
        mockAppRoleLogin();
        mockSecretRead();

        const ctx2 = makeContext();
        const result = await loadSecrets(ctx2, {
          bootstrapPath: BOOTSTRAP_PATH,
          expiration: 1000,
        });
        expect(result).to.deep.equal(testSecrets);
      } finally {
        clock.restore();
      }
    });
  });
});
