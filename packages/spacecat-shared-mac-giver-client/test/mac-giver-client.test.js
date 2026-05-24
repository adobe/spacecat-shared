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
    imsClient = { getServiceAccessToken: sandbox.stub().resolves('service-access-token') };
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

  describe('getPermissions', () => {
    let client;

    beforeEach(() => {
      client = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: console,
      });
    });

    it('returns permitted permissions from a successful check response', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({
          'llmo/can_read': { allowed: true },
          'llmo/can_edit': { allowed: false },
          'llmo/can_manage': { allowed: true },
        }));

      const result = await client.getPermissions({
        userId: 'user1',
        imsOrgId: 'org1',
        permissions: ['llmo/can_read', 'llmo/can_edit', 'llmo/can_manage'],
        userToken: 'user-token',
      });

      expect(result).to.deep.equal(['llmo/can_read', 'llmo/can_manage']);
    });

    it('sends the correct request shape to MacGiver', async () => {
      let capturedBody;
      nock('http://localhost:8080')
        .post(CHECK_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, makeCheckResponse({}));

      await client.getPermissions({
        userId: 'user42',
        imsOrgId: 'org99',
        permissions: ['llmo/can_read', 'llmo/can_edit'],
        userToken: 'tok',
      });

      expect(capturedBody).to.deep.equal({
        subject: { type: 'user', id: 'user42', relation: null },
        permissions: ['llmo/can_read', 'llmo/can_edit'],
        object: { type: 'organization', id: 'org99' },
        namespaces: [],
      });
    });

    it('includes X-User-Token header when userToken is provided', async () => {
      let capturedHeaders;
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(function reply() {
          capturedHeaders = this.req.headers;
          return [200, makeCheckResponse({})];
        });

      await client.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
        userToken: 'end-user-token',
      });

      expect(capturedHeaders.authorization).to.include('Bearer service-access-token');
      expect(capturedHeaders['x-user-token']).to.include('end-user-token');
    });

    it('omits X-User-Token header when userToken is not provided', async () => {
      let capturedHeaders;
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(function reply() {
          capturedHeaders = this.req.headers;
          return [200, makeCheckResponse({})];
        });

      await client.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
      });

      expect(capturedHeaders['x-user-token']).to.be.undefined;
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

      await expect(failingClient.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
        userToken: 'tok',
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

      const result = await client.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
        userToken: 'tok',
      });

      expect(result).to.deep.equal([]);
    });

    it('returns [] when results map is absent in the response', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, { status: 'SUCCESS', results: null });

      const result = await client.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read'],
        userToken: 'tok',
      });

      expect(result).to.deep.equal([]);
    });

    it('returns [] when all permissions are denied', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({
          'llmo/can_read': { allowed: false },
          'llmo/can_edit': { allowed: false },
        }));

      const result = await client.getPermissions({
        userId: 'u',
        imsOrgId: 'o',
        permissions: ['llmo/can_read', 'llmo/can_edit'],
        userToken: 'tok',
      });

      expect(result).to.deep.equal([]);
    });
  });

  describe('checkPermission', () => {
    let client;

    beforeEach(() => {
      client = new MacGiverClient({
        macGiverBaseUrl: 'http://localhost:8080',
        imsClient,
        log: console,
      });
    });

    it('returns true when the permission is allowed', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({ 'llmo/can_read': { allowed: true } }));

      const result = await client.checkPermission({
        userId: 'user1',
        imsOrgId: 'org1',
        permission: 'llmo/can_read',
        userToken: 'user-token',
      });

      expect(result).to.be.true;
    });

    it('returns false when the permission is denied', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(200, makeCheckResponse({ 'llmo/can_read': { allowed: false } }));

      const result = await client.checkPermission({
        userId: 'user1',
        imsOrgId: 'org1',
        permission: 'llmo/can_read',
        userToken: 'user-token',
      });

      expect(result).to.be.false;
    });

    it('returns false (fail-closed) when MacGiver responds with a non-ok status code', async () => {
      nock('http://localhost:8080')
        .post(CHECK_PATH)
        .reply(503);

      const result = await client.checkPermission({
        userId: 'u',
        imsOrgId: 'o',
        permission: 'llmo/can_read',
        userToken: 'tok',
      });

      expect(result).to.be.false;
    });

    it('sends a single-permission list in the request body', async () => {
      let capturedBody;
      nock('http://localhost:8080')
        .post(CHECK_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, makeCheckResponse({ 'llmo/can_edit': { allowed: true } }));

      await client.checkPermission({
        userId: 'u42',
        imsOrgId: 'org99',
        permission: 'llmo/can_edit',
        userToken: 'tok',
      });

      expect(capturedBody.permissions).to.deep.equal(['llmo/can_edit']);
    });
  });
});
