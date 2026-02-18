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
});
