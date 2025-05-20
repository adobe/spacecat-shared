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

import { expect, use } from 'chai';
import { SignJWT } from 'jose';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import CookieAuthHandler from '../../../src/auth/handlers/cookie-auth.js';
import AbstractHandler from '../../../src/auth/handlers/abstract.js';
import AuthInfo from '../../../src/auth/auth-info.js';

use(chaiAsPromised);

const generateKeyPairAsync = promisify(generateKeyPair);

let privateKey;
let publicKeyB64;

const createToken = async (payload, exp = 3600) => new SignJWT(payload)
  .setProtectedHeader({ alg: 'ES256' })
  .setIssuedAt()
  .setIssuer(payload.iss)
  .setAudience('test')
  .setExpirationTime(`${exp} sec`)
  .sign(privateKey);

const createTokenPayload = (overrides = {}) => ({
  iss: 'https://spacecat.experiencecloud.live',
  created_at: Date.now(),
  expires_in: 3600,
  ...overrides,
});

describe('CookieAuthHandler', () => {
  let logStub;
  let handler;

  before(async () => {
    // Generate test key pair
    const { privateKey: priv, publicKey: pub } = await generateKeyPairAsync('ec', {
      namedCurve: 'P-256',
    });
    privateKey = priv;
    publicKeyB64 = Buffer.from(await pub.export({ type: 'spki', format: 'pem' })).toString('base64');
  });

  beforeEach(() => {
    logStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      error: sinon.stub(),
    };
    handler = new CookieAuthHandler(logStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('is an instance of AbstractHandler', () => {
    expect(handler).to.be.instanceof(AbstractHandler);
  });

  it('sets the name and log properties correctly', () => {
    expect(handler.name).to.equal('cookieAuth');
    expect(handler.logger).to.equal(logStub);
  });

  it('logs messages correctly', () => {
    handler.log('test message', 'info');
    expect(logStub.info.calledWith('[cookieAuth] test message')).to.be.true;
  });

  it('returns null when there is no session token', async () => {
    const context = {
      env: { AUTH_PUBLIC_KEY_B64: publicKeyB64 },
      pathInfo: { headers: {} },
    };
    const result = await handler.checkAuth({}, context);
    expect(result).to.be.null;
    expect(logStub.debug.calledWith('[cookieAuth] No session token provided')).to.be.true;
  });

  it('returns null when public key is not provided', async () => {
    const context = {
      env: {},
      pathInfo: { headers: { cookie: 'sessionToken=abc123' } },
    };
    const result = await handler.checkAuth({}, context);
    expect(result).to.be.null;
    expect(logStub.error.calledWith('[cookieAuth] Failed to validate token: No public key provided')).to.be.true;
  });

  describe('token validation', () => {
    let context;

    beforeEach(() => {
      context = {
        env: { AUTH_PUBLIC_KEY_B64: publicKeyB64 },
        func: { version: 'ci' },
        log: logStub,
      };
    });

    it('returns null when token has invalid issuer', async () => {
      const token = await createToken(createTokenPayload({ iss: 'wrong' }));
      context.pathInfo = { headers: { cookie: `sessionToken=${token}` } };

      const result = await handler.checkAuth({}, context);
      expect(result).to.be.null;
      expect(logStub.error.calledWith('[cookieAuth] Failed to validate token: unexpected "iss" claim value')).to.be.true;
    });

    it('returns null when token is expired', async () => {
      const clock = sinon.useFakeTimers();
      const token = await createToken(createTokenPayload({}), 0);
      context.pathInfo = { headers: { cookie: `sessionToken=${token}` } };

      clock.tick(6000);
      const result = await handler.checkAuth({}, context);
      clock.restore();

      expect(result).to.be.null;
      expect(logStub.error.calledWith('[cookieAuth] Failed to validate token: "exp" claim timestamp check failed')).to.be.true;
    });

    it('successfully validates an admin token', async () => {
      const token = await createToken(createTokenPayload({
        is_admin: true,
      }));
      context.pathInfo = { headers: { cookie: `sessionToken=${token}` } };

      const result = await handler.checkAuth({}, context);
      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.true;
      expect(result.type).to.equal('cookieAuth');
      expect(result.scopes).to.deep.include({ name: 'admin' });
    });

    it('successfully validates a user token with tenants', async () => {
      const orgId = 'tenant1';
      const scope = 'service1';
      const token = await createToken(createTokenPayload({
        is_admin: false,
        tenants: [
          { id: orgId, subServices: [scope] },
          { id: 'tenant2', subServices: ['service2'] },
        ],
      }));
      context.pathInfo = { headers: { cookie: `sessionToken=${token}` } };

      const result = await handler.checkAuth({}, context);
      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.true;
      expect(result.type).to.equal('cookieAuth');
      expect(result.scopes).to.have.lengthOf(2);
      expect(result.scopes).to.deep.include({
        name: 'user',
        domains: [orgId],
        subScopes: [scope],
      });
    });

    it('handles empty tenants array', async () => {
      const token = await createToken(createTokenPayload({
        is_admin: false,
        tenants: [],
      }));
      context.pathInfo = { headers: { cookie: `sessionToken=${token}` } };

      const result = await handler.checkAuth({}, context);
      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.true;
      expect(result.type).to.equal('cookieAuth');
      expect(result.scopes).to.be.an('array').that.is.empty;
    });
  });
});
