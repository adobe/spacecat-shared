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
import sinonChai from 'sinon-chai';
import nock from 'nock';
import sinon from 'sinon';

import MacGiverClient from '../src/mac-giver-client.js';

use(chaiAsPromised);
use(sinonChai);

const CHECK_PATH = '/api/facs/permissions/check';

const makeCheckResponse = (results) => ({ status: 'SUCCESS', results });

describe('MacGiverClient', () => {
  const sandbox = sinon.createSandbox();
  let imsClient;

  beforeEach(() => {
    // Mirror the real ImsClient.getServiceAccessToken() shape:
    // { access_token, expires_in, token_type } — only access_token is used here.
    imsClient = {
      getServiceAccessToken: sandbox.stub().resolves({
        access_token: 'service-access-token',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    };
    nock.cleanAll();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('createFrom', () => {
    it('uses MACGIVER_BASE_URL from env when set', () => {
      const context = {
        env: { MACGIVER_BASE_URL: 'https://macgiver.example.com' },
        imsClient,
        log: console,
      };
      const client = MacGiverClient.createFrom(context);
      expect(client.macGiverBaseUrl).to.equal('https://macgiver.example.com');
    });

    it('defaults to http://localhost:8080 when MACGIVER_BASE_URL is not set', () => {
      const context = { env: {}, imsClient, log: console };
      const client = MacGiverClient.createFrom(context);
      expect(client.macGiverBaseUrl).to.equal('http://localhost:8080');
    });

    it('defaults to http://localhost:8080 when env is absent', () => {
      const context = { imsClient, log: console };
      const client = MacGiverClient.createFrom(context);
      expect(client.macGiverBaseUrl).to.equal('http://localhost:8080');
    });

    it('falls back to console when log is not provided', () => {
      const context = { env: {}, imsClient };
      const client = MacGiverClient.createFrom(context);
      expect(client.log).to.equal(console);
    });
  });

  describe('checkListOfPermission', () => {
    let client;

    beforeEach(() => {
      client = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: console,
      });
    });

    it('returns the allowed subset of the requested permissions', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({
          'llmo/can_read': { allowed: true },
          'llmo/can_edit': { allowed: false },
          'llmo/can_manage': { allowed: true },
        }));

      const result = await client.checkListOfPermission({
        userId: 'user1',
        imsOrgId: 'org1',
        permissions: ['llmo/can_read', 'llmo/can_edit', 'llmo/can_manage'],
      });

      expect(result).to.deep.equal(['llmo/can_read', 'llmo/can_manage']);
    });

    it('sends the permissions list (empty namespaces) and no X-User-Token header', async () => {
      let capturedBody;
      let capturedHeaders;
      nock('http://localhost:8080')
        .post(CHECK_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(function reply() {
          capturedHeaders = this.req.headers;
          return [200, makeCheckResponse({})];
        });

      await client.checkListOfPermission({
        userId: 'user42',
        imsOrgId: 'org99',
        permissions: ['llmo/can_read', 'llmo/can_edit'],
      });

      expect(capturedBody).to.deep.equal({
        subject: { type: 'user', id: 'user42' },
        object: { type: 'org', id: 'org99' },
        permissions: ['llmo/can_read', 'llmo/can_edit'],
      });
      expect(capturedHeaders.authorization).to.include('Bearer service-access-token');
      expect(capturedHeaders['x-user-token']).to.be.undefined;
    });

    it('throws when the IMS service-token response is missing access_token', async () => {
      imsClient.getServiceAccessToken.resolves({ expires_in: 3600, token_type: 'bearer' });

      await expect(client.checkListOfPermission({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
      })).to.be.rejectedWith(/missing access_token/);
    });

    it('throws when userId or imsOrgId is missing (no request fired)', async () => {
      await expect(client.checkListOfPermission({
        imsOrgId: 'o', permissions: ['llmo/can_read'],
      })).to.be.rejectedWith(/userId and imsOrgId are required/);
      await expect(client.checkListOfPermission({
        userId: 'u', permissions: ['llmo/can_read'],
      })).to.be.rejectedWith(/userId and imsOrgId are required/);
      expect(imsClient.getServiceAccessToken).to.not.have.been.called;
    });

    it('throws when permissions is missing or empty', async () => {
      await expect(client.checkListOfPermission({
        userId: 'u', imsOrgId: 'o', permissions: [],
      })).to.be.rejectedWith(/permissions must be a non-empty array/);
      await expect(client.checkListOfPermission({
        userId: 'u', imsOrgId: 'o',
      })).to.be.rejectedWith(/permissions must be a non-empty array/);
    });

    it('throws and logs when MacGiver responds with a non-ok status code', async () => {
      const logWarn = sinon.spy();
      const failingClient = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: { warn: logWarn, info: () => {}, debug: () => {} },
      });

      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(503);

      await expect(failingClient.checkListOfPermission({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
      })).to.be.rejectedWith('MacGiver returned 503');

      expect(logWarn).to.have.been.calledOnce;
      const [logFields, logMessage] = logWarn.firstCall.args;
      expect(logFields).to.include({
        tag: 'macgiver', status: 503, userId: 'u', imsOrgId: 'o',
      });
      expect(logMessage).to.match(/non-2xx/i);
    });

    it('returns [] when response status is not SUCCESS', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, { status: 'ERROR', results: null, error: 'upstream failure' });

      const result = await client.checkListOfPermission({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
      });

      expect(result).to.deep.equal([]);
    });

    it('returns [] when results map is absent in the response', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, { status: 'SUCCESS', results: null });

      const result = await client.checkListOfPermission({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
      });

      expect(result).to.deep.equal([]);
    });

    it('returns [] when all requested permissions are denied', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({
          'llmo/can_read': { allowed: false },
          'llmo/can_edit': { allowed: false },
        }));

      const result = await client.checkListOfPermission({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read', 'llmo/can_edit'],
      });

      expect(result).to.deep.equal([]);
    });
  });

  describe('checkAllPermission', () => {
    let client;

    beforeEach(() => {
      client = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: console,
      });
    });

    it('returns every allowed permission across the requested namespaces', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({
          'llmo/can_view': { allowed: true },
          'llmo/can_manage_users': { allowed: true },
          'llmo/can_deploy': { allowed: false },
        }));

      const result = await client.checkAllPermission({
        userId: 'user1',
        imsOrgId: 'org1',
        namespaces: ['llmo'],
      });

      expect(result).to.deep.equal(['llmo/can_view', 'llmo/can_manage_users']);
    });

    it('sends the namespaces list (empty permissions) and no X-User-Token header', async () => {
      let capturedBody;
      let capturedHeaders;
      nock('http://localhost:8080')
        .post(CHECK_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(function reply() {
          capturedHeaders = this.req.headers;
          return [200, makeCheckResponse({})];
        });

      await client.checkAllPermission({
        userId: 'user42',
        imsOrgId: 'org99',
        namespaces: ['llmo', 'aso'],
      });

      expect(capturedBody).to.deep.equal({
        subject: { type: 'user', id: 'user42' },
        object: { type: 'org', id: 'org99' },
        namespaces: ['llmo', 'aso'],
      });
      expect(capturedHeaders.authorization).to.include('Bearer service-access-token');
      expect(capturedHeaders['x-user-token']).to.be.undefined;
    });

    it('throws when MacGiver responds with a non-ok status code', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(500);

      await expect(client.checkAllPermission({
        userId: 'u',
        imsOrgId: 'o',
        namespaces: ['llmo'],
      })).to.be.rejectedWith('MacGiver returned 500');
    });

    it('throws when userId or imsOrgId is missing (no request fired)', async () => {
      await expect(client.checkAllPermission({
        imsOrgId: 'o', namespaces: ['llmo'],
      })).to.be.rejectedWith(/userId and imsOrgId are required/);
      await expect(client.checkAllPermission({
        userId: 'u', namespaces: ['llmo'],
      })).to.be.rejectedWith(/userId and imsOrgId are required/);
      expect(imsClient.getServiceAccessToken).to.not.have.been.called;
    });

    it('throws when namespaces is missing or empty', async () => {
      await expect(client.checkAllPermission({
        userId: 'u', imsOrgId: 'o', namespaces: [],
      })).to.be.rejectedWith(/namespaces must be a non-empty array/);
      await expect(client.checkAllPermission({
        userId: 'u', imsOrgId: 'o',
      })).to.be.rejectedWith(/namespaces must be a non-empty array/);
    });

    it('logs a warning when MacGiver returns a non-SUCCESS status', async () => {
      const logWarn = sinon.spy();
      const warnClient = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: { warn: logWarn, info: () => {}, debug: () => {} },
      });
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, { status: 'ERROR', results: null });

      const result = await warnClient.checkAllPermission({
        userId: 'u', imsOrgId: 'o', namespaces: ['llmo'],
      });

      expect(result).to.deep.equal([]);
      expect(logWarn).to.have.been.calledOnce;
      expect(logWarn.firstCall.args[1]).to.match(/non-SUCCESS/i);
    });
  });
});
