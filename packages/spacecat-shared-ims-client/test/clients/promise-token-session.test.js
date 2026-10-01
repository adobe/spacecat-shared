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
import nock from 'nock';
import sinon from 'sinon';

import ImsPromiseClient from '../../src/clients/ims-promise-client.js';
import {
  PromiseTokenSession,
  NeedsReauthError,
  createPromiseTokenSession,
} from '../../src/clients/promise-token-session.js';
import { encrypt, IMS_TOKEN_ENDPOINT, IMS_INVALIDATE_TOKEN_ENDPOINT } from '../../src/utils.js';

use(chaiAsPromised);

describe('PromiseTokenSession', () => {
  const DUMMY_HOST = 'ims.example.com';
  const initialToken = 'initialPromiseTokenExample';
  let mockLog;
  let sandbox;
  let mockContext;
  let consumerClient;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = sinon.mock(console);
    mockContext = {
      log: mockLog.object,
      env: {
        IMS_HOST: DUMMY_HOST,
        IMS_PROMISE_CONSUMER_CLIENT_ID: 'consumerClientIdExample',
        IMS_PROMISE_CONSUMER_CLIENT_SECRET: 'consumerClientSecretExample',
      },
    };
    consumerClient = ImsPromiseClient.createFrom(
      mockContext,
      ImsPromiseClient.CLIENT_TYPE.CONSUMER,
    );
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  function mockExchange(promiseTokenBeingExchanged, response) {
    nock(`https://${DUMMY_HOST}`)
      .post(
        IMS_TOKEN_ENDPOINT,
        (body) => body.match('name="grant_type"\r\n\r\npromise_exchange')
          && body.match(`name="promise_token"\r\n\r\n${promiseTokenBeingExchanged}`),
      )
      .reply(response.status, response.body);
  }

  function mockInvalidate(promiseTokenBeingInvalidated, status) {
    nock(`https://${DUMMY_HOST}`)
      .post(
        IMS_INVALIDATE_TOKEN_ENDPOINT,
        (body) => body.match('name="token_type"\r\n\r\npromise_token')
          && body.match(`name="token"\r\n\r\n${promiseTokenBeingInvalidated}`),
      )
      .reply(status);
  }

  describe('constructor', () => {
    it('throws when given a non-ImsPromiseClient', () => {
      expect(() => new PromiseTokenSession({}, initialToken))
        .to.throw('PromiseTokenSession requires an ImsPromiseClient instance.');
    });

    it('throws when given an EMITTER-type client', () => {
      mockContext.env.IMS_PROMISE_EMITTER_CLIENT_ID = 'emitterClientIdExample';
      mockContext.env.IMS_PROMISE_EMITTER_CLIENT_SECRET = 'emitterClientSecretExample';
      mockContext.env.IMS_PROMISE_EMITTER_DEFINITION_ID = 'promiseDefinitionIdExample';
      const emitterClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      );
      expect(() => new PromiseTokenSession(emitterClient, initialToken))
        .to.throw('PromiseTokenSession requires a CONSUMER-type ImsPromiseClient.');
    });

    it('throws when given an empty initial promise token', () => {
      expect(() => new PromiseTokenSession(consumerClient, ''))
        .to.throw('PromiseTokenSession requires a non-empty initial promise token.');
    });
  });

  describe('createPromiseTokenSession factory', () => {
    it('returns a PromiseTokenSession instance', () => {
      const session = createPromiseTokenSession(consumerClient, initialToken);
      expect(session).to.be.an.instanceOf(PromiseTokenSession);
    });
  });

  describe('exchange', () => {
    it('returns the access token and persists the rolled promise token', async () => {
      mockExchange(initialToken, {
        status: 200,
        body: {
          access_token: 'accessTokenExample1',
          token_type: 'access_token',
          expires_in: 299,
          promise_token: 'rolledPromiseTokenExample1',
          promise_token_expires_in: 14399,
        },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      const accessToken = await session.exchange();

      expect(accessToken).to.equal('accessTokenExample1');
      expect(session.promiseToken).to.equal('rolledPromiseTokenExample1');
      expect(session.isExpired()).to.equal(false);
      expect(session.getRemainingMs()).to.be.greaterThan(0);
    });

    it('rolls the promise token forward across repeated exchanges', async () => {
      mockExchange(initialToken, {
        status: 200,
        body: {
          access_token: 'accessTokenExample1',
          expires_in: 299,
          promise_token: 'rolledPromiseTokenExample1',
          promise_token_expires_in: 14399,
        },
      });
      mockExchange('rolledPromiseTokenExample1', {
        status: 200,
        body: {
          access_token: 'accessTokenExample2',
          expires_in: 299,
          promise_token: 'rolledPromiseTokenExample2',
          promise_token_expires_in: 14399,
        },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      const firstAccessToken = await session.exchange();
      const secondAccessToken = await session.exchange();

      expect(firstAccessToken).to.equal('accessTokenExample1');
      expect(secondAccessToken).to.equal('accessTokenExample2');
      expect(session.promiseToken).to.equal('rolledPromiseTokenExample2');
    });

    it('passes enableEncryption through to the underlying client', async () => {
      mockContext.env.AUTOFIX_CRYPT_SECRET = 'secret';
      mockContext.env.AUTOFIX_CRYPT_SALT = 'salt';
      const encryptionAwareClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );
      const encryptedInitialToken = await encrypt({
        secret: mockContext.env.AUTOFIX_CRYPT_SECRET,
        salt: mockContext.env.AUTOFIX_CRYPT_SALT,
      }, initialToken);

      mockExchange(initialToken, {
        status: 200,
        body: {
          access_token: 'accessTokenExample1',
          expires_in: 299,
          promise_token: initialToken,
          promise_token_expires_in: 14399,
        },
      });

      const session = new PromiseTokenSession(
        encryptionAwareClient,
        encryptedInitialToken,
        { enableEncryption: true },
      );
      const accessToken = await session.exchange();

      expect(accessToken).to.equal('accessTokenExample1');
      // the rolled promise token comes back re-encrypted by the client
      expect(session.promiseToken).to.match(/^[0-9a-f]*::[0-9a-f]*::[0-9a-f]*$/);
    });

    it('throws NeedsReauthError on a 401 from IMS', async () => {
      mockExchange(initialToken, {
        status: 401,
        body: { error: 'invalid_promise_token' },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await expect(session.exchange()).to.be.rejectedWith(NeedsReauthError);
    });

    it('throws NeedsReauthError on a 403 from IMS', async () => {
      mockExchange(initialToken, {
        status: 403,
        body: { error: 'forbidden' },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await expect(session.exchange()).to.be.rejectedWith(NeedsReauthError);
    });

    it('rethrows non-reauth errors as-is', async () => {
      // 400 is non-retryable in the underlying client (only 429/5xx retry),
      // so this exercises the rethrow path without triggering retry/backoff.
      mockExchange(initialToken, {
        status: 400,
        body: { error: 'invalid_request' },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      const error = await session.exchange().catch((e) => e);

      expect(error).to.not.be.an.instanceOf(NeedsReauthError);
      expect(error.message).to.match(/status: 400/);
    });

    it('throws NeedsReauthError immediately if the session was already invalidated', async () => {
      mockInvalidate(initialToken, 200);

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await session.invalidate();

      await expect(session.exchange()).to.be.rejectedWith(
        NeedsReauthError,
        'Promise token session has already been invalidated.',
      );
    });
  });

  describe('isExpired / getRemainingMs', () => {
    it('returns false / null before any exchange has happened', () => {
      const session = new PromiseTokenSession(consumerClient, initialToken);
      expect(session.isExpired()).to.equal(false);
      expect(session.getRemainingMs()).to.equal(null);
    });

    it('reports expired once the rolled TTL has elapsed', async () => {
      // Only fake Date — faking setTimeout too would also stall the IMS client's
      // own retry/backoff timers and the test runner's timeout.
      const clock = sandbox.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
      mockExchange(initialToken, {
        status: 200,
        body: {
          access_token: 'accessTokenExample1',
          expires_in: 299,
          promise_token: 'rolledPromiseTokenExample1',
          promise_token_expires_in: 10,
        },
      });

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await session.exchange();
      expect(session.isExpired()).to.equal(false);

      clock.tick(11 * 1000);
      expect(session.isExpired()).to.equal(true);
      expect(session.getRemainingMs()).to.equal(0);
    });
  });

  describe('invalidate', () => {
    it('invalidates the current promise token', async () => {
      mockInvalidate(initialToken, 200);

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await session.invalidate();

      expect(session.invalidated).to.equal(true);
    });

    it('invalidates the rolled promise token, not the original, after an exchange', async () => {
      mockExchange(initialToken, {
        status: 200,
        body: {
          access_token: 'accessTokenExample1',
          expires_in: 299,
          promise_token: 'rolledPromiseTokenExample1',
          promise_token_expires_in: 14399,
        },
      });
      mockInvalidate('rolledPromiseTokenExample1', 200);

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await session.exchange();
      await session.invalidate();

      expect(session.invalidated).to.equal(true);
    });

    it('is idempotent — a second call is a no-op', async () => {
      mockInvalidate(initialToken, 200);

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await session.invalidate();
      await session.invalidate();

      expect(session.invalidated).to.equal(true);
    });

    it('marks the session invalidated even if the IMS call fails', async () => {
      mockInvalidate(initialToken, 400);

      const session = new PromiseTokenSession(consumerClient, initialToken);
      await expect(session.invalidate()).to.be.rejected;
      expect(session.invalidated).to.equal(true);
    });
  });
});
