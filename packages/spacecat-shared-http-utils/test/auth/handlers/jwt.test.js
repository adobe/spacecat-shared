/*
 * Copyright 2024 Adobe. All rights reserved.
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
import crypto from 'crypto';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import { importPKCS8, SignJWT } from 'jose';

import SpacecatJWTHandler from '../../../src/auth/handlers/jwt.js';
import AbstractHandler from '../../../src/auth/handlers/abstract.js';
import AuthInfo from '../../../src/auth/auth-info.js';

use(chaiAsPromised);

const publicKey = fs.readFileSync('test/fixtures/auth/jwt/public_key.pem', 'utf8');

const privateKeyEncrypted = fs.readFileSync('test/fixtures/auth/jwt/private_key.pem', 'utf8');
const decryptedPrivateKey = crypto.createPrivateKey({
  key: privateKeyEncrypted,
  format: 'pem',
  passphrase: 'test',
});
const decryptedPrivateKeyPEM = decryptedPrivateKey.export({ format: 'pem', type: 'pkcs8' });
const privateKey = await importPKCS8(decryptedPrivateKeyPEM, 'ES256');

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

describe('SpacecatJWTHandler', () => {
  let logStub;
  let handler;

  beforeEach(() => {
    logStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      error: sinon.stub(),
    };
    handler = new SpacecatJWTHandler(logStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('is an instance of AbstractHandler', () => {
    expect(handler).to.be.instanceof(AbstractHandler);
  });

  it('sets the name and log properties correctly', () => {
    expect(handler.name).to.equal('jwt');
    expect(handler.logger).to.equal(logStub);
  });

  it('logs messages correctly', () => {
    handler.log('test message', 'info');

    expect(logStub.info.calledWith('[jwt] test message')).to.be.true;
  });

  it('returns null when there is no authorization header', async () => {
    const context = {
      env: { AUTH_PUBLIC_KEY: publicKey },
    };
    const result = await handler.checkAuth({}, context);

    expect(result).to.be.instanceof(AuthInfo);
    expect(result.authenticated).to.be.false;
    expect(result.reason).to.equal('No bearer token provided');
  });

  it('returns null when "Bearer " is missing from the authorization header', async () => {
    const context = {
      env: { AUTH_PUBLIC_KEY: publicKey },
      pathInfo: { headers: { authorization: 'some-token' } },
    };
    const result = await handler.checkAuth({}, context);

    expect(result).to.be.instanceof(AuthInfo);
    expect(result.authenticated).to.be.false;
    expect(result.reason).to.equal('No bearer token provided');
  });

  it('returns null when the token is empty', async () => {
    const context = {
      env: { AUTH_PUBLIC_KEY: publicKey },
      pathInfo: { headers: { authorization: 'Bearer ' } },
    };
    const result = await handler.checkAuth({}, context);

    expect(result).to.be.instanceof(AuthInfo);
    expect(result.authenticated).to.be.false;
    expect(result.reason).to.equal('No bearer token provided');
  });

  describe('token validation', () => {
    let context;

    beforeEach(() => {
      context = {
        env: { AUTH_PUBLIC_KEY: publicKey },
        func: { version: 'ci' },
        log: logStub,
      };
    });

    afterEach(() => {
    });

    it('sets authenticated false when no public key is provided', async () => {
      context = { env: {} };

      const result = await handler.checkAuth({}, context);

      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.false;
      expect(result.reason).to.equal('No public key provided');
    });

    it('sets authenticated false when the token was created by an unexpected issuer', async () => {
      const token = await createToken(createTokenPayload({ iss: 'wrong' }));
      context.pathInfo = { headers: { authorization: `Bearer ${token}` } };

      const result = await handler.checkAuth({}, context);

      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.false;
      expect(result.reason).to.equal('unexpected "iss" claim value');
      expect(logStub.error.calledWith('[jwt] Failed to validate token: unexpected "iss" claim value')).to.be.true;
    });

    it('returns null when the token is expired', async () => {
      // Use fake timers
      const clock = sinon.useFakeTimers();

      // Create a token that expires in 5 seconds
      const token = await createToken(createTokenPayload({}), 0);
      context.pathInfo = { headers: { authorization: `Bearer ${token}` } };

      // Advance time by 6 seconds to force expiration
      clock.tick(6000);

      const result = await handler.checkAuth({}, context);

      // Restore real timers
      clock.restore();

      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.false;
      expect(result.reason).to.equal('"exp" claim timestamp check failed');
      expect(logStub.error.calledWith('[jwt] Failed to validate token: "exp" claim timestamp check failed')).to.be.true;
    });

    it('successfully validates a token and returns the profile', async () => {
      const token = await createToken(createTokenPayload({ user_id: 'test-user' }));
      context.pathInfo = { headers: { authorization: `Bearer ${token}` } };

      const result = await handler.checkAuth({}, context);

      expect(result).to.be.instanceof(AuthInfo);
      expect(result.authenticated).to.be.true;
      expect(result.profile).to.be.an('object');
      expect(result.profile).to.have.property('iss', 'https://spacecat.experiencecloud.live');
      expect(result.profile).to.have.property('user_id', 'test-user');
    });
  });
});
