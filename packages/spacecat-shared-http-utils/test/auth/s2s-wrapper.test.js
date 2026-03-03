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
import crypto from 'crypto';
import sinon from 'sinon';
import fs from 'fs';
import { importPKCS8, SignJWT } from 'jose';

import { s2sAuthWrapper } from '../../src/auth/s2s-wrapper.js';

const publicKey = fs.readFileSync('test/fixtures/auth/jwt/public_key.pem', 'utf8');
const publicKeyB64 = Buffer.from(publicKey, 'utf-8').toString('base64');

const privateKeyEncrypted = fs.readFileSync('test/fixtures/auth/jwt/private_key.pem', 'utf8');
const decryptedPrivateKey = crypto.createPrivateKey({
  key: privateKeyEncrypted,
  format: 'pem',
  passphrase: 'test',
});
const decryptedPrivateKeyPEM = decryptedPrivateKey.export({ format: 'pem', type: 'pkcs8' });
const josePrivateKey = await importPKCS8(decryptedPrivateKeyPEM, 'ES256');

const createToken = async (payload, exp = 3600) => new SignJWT(payload)
  .setProtectedHeader({ alg: 'ES256' })
  .setIssuedAt()
  .setIssuer(payload.iss)
  .setAudience('test')
  .setExpirationTime(`${exp} sec`)
  .sign(josePrivateKey);

const createTokenPayload = (overrides = {}) => ({
  iss: 'https://spacecat.experiencecloud.live',
  ...overrides,
});

const routeCapabilities = {
  'GET /sites': 'site:read',
  'POST /sites': 'site:write',
  'GET /sites/:siteId': 'site:read',
  'PATCH /sites/:siteId': 'site:write',
  'GET /sites/:siteId/opportunities': 'opportunity:read',
  'POST /sites/:siteId/opportunities': 'opportunity:write',
  'GET /sites/:siteId/opportunities/:opportunityId': 'opportunity:read',
};

describe('s2sAuthWrapper', () => {
  let logStub;
  let handler;
  let context;

  beforeEach(() => {
    logStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      error: sinon.stub(),
    };
    handler = sinon.stub().resolves({ status: 200 });
    context = {
      env: { AUTH_PUBLIC_KEY_B64: publicKeyB64 },
      log: logStub,
      pathInfo: { method: 'GET', suffix: '/sites', headers: {} },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns 401 when no bearer token is provided', async () => {
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(401);
    expect(handler.called).to.be.false;
  });

  it('returns 401 when public key is not configured', async () => {
    context.env = {};
    context.pathInfo.headers = { authorization: 'Bearer some-token' };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(401);
    expect(handler.called).to.be.false;
  });

  it('returns 401 when the token is invalid', async () => {
    context.pathInfo.headers = { authorization: 'Bearer invalid-token' };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(401);
    expect(handler.called).to.be.false;
  });

  it('returns 401 when the token has wrong issuer', async () => {
    const token = await createToken(createTokenPayload({ iss: 'wrong-issuer' }));
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(401);
    expect(handler.called).to.be.false;
  });

  it('returns 401 when the token is expired', async () => {
    const clock = sinon.useFakeTimers();
    const token = await createToken(createTokenPayload({
      is_s2s_consumer: true,
      tenants: [{ id: 'org1', capabilities: ['site:read'] }],
    }), 0);
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    clock.tick(6000);

    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);
    clock.restore();

    expect(result.status).to.equal(401);
    expect(handler.called).to.be.false;
  });

  it('passes through when token is not an S2S consumer (end-user token)', async () => {
    const token = await createToken(createTokenPayload({
      is_s2s_consumer: false,
      tenants: [{ id: 'org1', capabilities: ['site:read'] }],
    }));
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result).to.deep.equal({ status: 200 });
    expect(handler.calledOnce).to.be.true;
    expect(context.s2sCtx).to.deep.equal({});
  });

  it('passes through when is_s2s_consumer claim is absent', async () => {
    const token = await createToken(createTokenPayload({}));
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result).to.deep.equal({ status: 200 });
    expect(handler.calledOnce).to.be.true;
    expect(context.s2sCtx).to.deep.equal({});
  });

  it('returns 403 when S2S consumer token has no tenants', async () => {
    const token = await createToken(createTokenPayload({ is_s2s_consumer: true }));
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(403);
    expect(handler.called).to.be.false;
  });

  it('returns 403 when S2S consumer token has tenants with empty capabilities', async () => {
    const token = await createToken(createTokenPayload({
      is_s2s_consumer: true,
      tenants: [{ id: 'org1', capabilities: [] }],
    }));
    context.pathInfo.headers = { authorization: `Bearer ${token}` };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
    const result = await wrapped({}, context);

    expect(result.status).to.equal(403);
    expect(handler.called).to.be.false;
  });

  describe('route-based capability resolution', () => {
    it('matches a static route and checks the capability', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        client_id: 'test-client-123',
        tenants: [{ id: 'org1', capabilities: ['site:read'] }],
      }));
      context.pathInfo = { method: 'GET', suffix: '/sites', headers: { authorization: `Bearer ${token}` } };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(context.s2sCtx).to.deep.equal({
        clientId: 'test-client-123',
        capabilities: ['site:read'],
        scopedOrgId: 'org1',
      });
    });

    it('matches a dynamic route with params', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['opportunity:read'] }],
      }));
      context.pathInfo = {
        method: 'GET',
        suffix: '/sites/abc-123/opportunities/def-456',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('returns 403 when token lacks the capability for the matched route', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['site:read'] }],
      }));
      context.pathInfo = {
        method: 'POST',
        suffix: '/sites/abc-123/opportunities',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(logStub.error.calledWithMatch('missing required capability: opportunity:write')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('returns 401 when route is not in the capabilities map', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['site:read'] }],
      }));
      context.pathInfo = {
        method: 'GET',
        suffix: '/unknown/route',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(401);
      expect(logStub.error.calledWithMatch('not allowed for S2S consumers')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('passes through when no routeCapabilities is provided', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['anything'] }],
      }));
      context.pathInfo = {
        method: 'GET',
        suffix: '/sites',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler);
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('returns 401 when pathInfo is missing method or suffix', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['site:read'] }],
      }));
      context.pathInfo = { headers: { authorization: `Bearer ${token}` } };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(401);
      expect(handler.called).to.be.false;
    });

    it('handles malformed route keys without a space separator', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [{ id: 'org1', capabilities: ['site:read'] }],
      }));
      context.pathInfo = {
        method: 'GET',
        suffix: '/malformed',
        headers: { authorization: `Bearer ${token}` },
      };
      const malformedRouteCapabilities = { BADKEY: 'site:read' };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities: malformedRouteCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(401);
      expect(handler.called).to.be.false;
    });

    it('handles tenants without a capabilities property', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        tenants: [
          { id: 'org1' },
          { id: 'org2', capabilities: ['site:read'] },
        ],
      }));
      context.pathInfo = {
        method: 'GET',
        suffix: '/sites',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('collects capabilities across multiple tenants', async () => {
      const token = await createToken(createTokenPayload({
        is_s2s_consumer: true,
        client_id: 'multi-tenant-client',
        tenants: [
          { id: 'org1', capabilities: ['site:read'] },
          { id: 'org2', capabilities: ['opportunity:write'] },
        ],
      }));
      context.pathInfo = {
        method: 'POST',
        suffix: '/sites/abc-123/opportunities',
        headers: { authorization: `Bearer ${token}` },
      };
      const wrapped = s2sAuthWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(context.s2sCtx).to.deep.equal({
        clientId: 'multi-tenant-client',
        capabilities: ['site:read', 'opportunity:write'],
        scopedOrgId: 'org1',
      });
    });
  });

  it('caches the public key across invocations', async () => {
    const token = await createToken(createTokenPayload({
      is_s2s_consumer: true,
      tenants: [{ id: 'org1', capabilities: ['site:read'] }],
    }));
    context.pathInfo = { method: 'GET', suffix: '/sites', headers: { authorization: `Bearer ${token}` } };
    const wrapped = s2sAuthWrapper(handler, { routeCapabilities });

    await wrapped({}, context);
    await wrapped({}, context);

    expect(handler.calledTwice).to.be.true;
  });
});
