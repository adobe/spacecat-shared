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

import VaultClient from '../src/vault-client.js';

use(chaiAsPromised);

const VAULT_ADDR = 'https://vault.example.com';
const MOUNT_POINT = 'secret';
const ROLE_ID = 'test-role-id';
const SECRET_ID = 'test-secret-id';

describe('VaultClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('stores vault address and mount point', () => {
      const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      expect(client.vaultAddr).to.equal(VAULT_ADDR);
      expect(client.mountPoint).to.equal(MOUNT_POINT);
    });

    it('strips trailing slash from vault address', () => {
      const client = new VaultClient({ vaultAddr: `${VAULT_ADDR}/`, mountPoint: MOUNT_POINT });
      expect(client.vaultAddr).to.equal(VAULT_ADDR);
    });

    it('throws if vaultAddr is missing', () => {
      expect(() => new VaultClient({ mountPoint: MOUNT_POINT }))
        .to.throw('vaultAddr is required');
    });

    it('throws if mountPoint is missing', () => {
      expect(() => new VaultClient({ vaultAddr: VAULT_ADDR }))
        .to.throw('mountPoint is required');
    });
  });

  describe('authenticate', () => {
    it('authenticates via AppRole and stores token', async () => {
      const scope = nock(VAULT_ADDR)
        .post('/v1/auth/approle/login', { role_id: ROLE_ID, secret_id: SECRET_ID })
        .reply(200, {
          auth: {
            client_token: 'hvs.test-token-123',
            lease_duration: 3600,
            renewable: true,
          },
        });

      const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await client.authenticate(ROLE_ID, SECRET_ID);

      expect(client.token).to.equal('hvs.test-token-123');
      expect(client.tokenRenewable).to.equal(true);
      expect(client.tokenExpiry).to.be.a('number');
      expect(client.isAuthenticated()).to.equal(true);
      expect(scope.isDone()).to.equal(true);
    });

    it('is not authenticated before calling authenticate', () => {
      const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      expect(client.isAuthenticated()).to.equal(false);
    });

    it('is not authenticated after token expires', async () => {
      const now = Date.now();
      const stub = sinon.stub(Date, 'now');
      stub.returns(now);
      try {
        nock(VAULT_ADDR)
          .post('/v1/auth/approle/login')
          .reply(200, {
            auth: {
              client_token: 'hvs.expiring-token',
              lease_duration: 60,
              renewable: false,
            },
          });

        const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
        await client.authenticate(ROLE_ID, SECRET_ID);
        expect(client.isAuthenticated()).to.equal(true);

        stub.returns(now + 61 * 1000);
        expect(client.isAuthenticated()).to.equal(false);
      } finally {
        stub.restore();
      }
    });

    it('throws on authentication failure (403)', async () => {
      nock(VAULT_ADDR)
        .post('/v1/auth/approle/login')
        .reply(403, { errors: ['permission denied'] });

      const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await expect(client.authenticate(ROLE_ID, SECRET_ID))
        .to.be.rejectedWith('Vault authentication failed: 403');
    });

    it('throws on network error', async () => {
      nock(VAULT_ADDR)
        .post('/v1/auth/approle/login')
        .replyWithError('connection refused');

      const client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await expect(client.authenticate(ROLE_ID, SECRET_ID))
        .to.be.rejectedWith('Vault authentication request failed');
    });
  });

  describe('readSecret', () => {
    let client;

    beforeEach(async () => {
      nock(VAULT_ADDR)
        .post('/v1/auth/approle/login')
        .reply(200, {
          auth: { client_token: 'hvs.read-token', lease_duration: 3600, renewable: true },
        });
      client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await client.authenticate(ROLE_ID, SECRET_ID);
    });

    it('reads a KV V2 secret', async () => {
      const scope = nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/my/secret/path`)
        .matchHeader('X-Vault-Token', 'hvs.read-token')
        .reply(200, {
          data: {
            data: { username: 'admin', password: 's3cret' },
            metadata: { version: 1 },
          },
        });

      const result = await client.readSecret('my/secret/path');
      expect(result).to.deep.equal({ username: 'admin', password: 's3cret' });
      expect(scope.isDone()).to.equal(true);
    });

    it('throws on 404 (secret not found)', async () => {
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/missing/path`)
        .reply(404, { errors: [] });

      await expect(client.readSecret('missing/path'))
        .to.be.rejectedWith('Secret not found: missing/path');
    });

    it('throws on 403 (permission denied)', async () => {
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/data/forbidden/path`)
        .reply(403, { errors: ['permission denied'] });

      await expect(client.readSecret('forbidden/path'))
        .to.be.rejectedWith('Vault read failed: 403');
    });

    it('throws if not authenticated', async () => {
      const unauthClient = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await expect(unauthClient.readSecret('some/path'))
        .to.be.rejectedWith('Not authenticated');
    });
  });

  describe('getLastChangedDate', () => {
    let client;

    beforeEach(async () => {
      nock(VAULT_ADDR)
        .post('/v1/auth/approle/login')
        .reply(200, {
          auth: { client_token: 'hvs.meta-token', lease_duration: 3600, renewable: true },
        });
      client = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      await client.authenticate(ROLE_ID, SECRET_ID);
    });

    it('reads metadata and returns updated_time as epoch ms', async () => {
      const updatedTime = '2026-01-15T10:30:00.123456Z';
      const scope = nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/metadata/my/secret`)
        .matchHeader('X-Vault-Token', 'hvs.meta-token')
        .reply(200, {
          data: {
            updated_time: updatedTime,
            current_version: 3,
          },
        });

      const result = await client.getLastChangedDate('my/secret');
      expect(result).to.equal(new Date(updatedTime).getTime());
      expect(scope.isDone()).to.equal(true);
    });

    it('returns 0 on metadata read failure', async () => {
      nock(VAULT_ADDR)
        .get(`/v1/${MOUNT_POINT}/metadata/missing/secret`)
        .reply(404, { errors: [] });

      const result = await client.getLastChangedDate('missing/secret');
      expect(result).to.equal(0);
    });

    it('returns 0 when not authenticated', async () => {
      const unauthClient = new VaultClient({ vaultAddr: VAULT_ADDR, mountPoint: MOUNT_POINT });
      const result = await unauthClient.getLastChangedDate('some/path');
      expect(result).to.equal(0);
    });
  });
});
