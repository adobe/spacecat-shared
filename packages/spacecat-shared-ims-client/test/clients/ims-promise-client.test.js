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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';

import ImsPromiseClient from '../../src/clients/ims-promise-client.js';
import { encrypt, IMS_INVALIDATE_TOKEN_ENDPOINT, IMS_TOKEN_ENDPOINT } from '../../src/utils.js';

use(chaiAsPromised);

describe('ImsPromiseClient', () => {
  const DUMMY_HOST = 'ims.example.com';
  let mockLog;
  let sandbox;
  let mockContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = sinon.mock(console);
    mockContext = {
      log: mockLog.object,
      env: {
        IMS_HOST: DUMMY_HOST,
        IMS_PROMISE_EMITTER_CLIENT_ID: 'emitterClientIdExample',
        IMS_PROMISE_EMITTER_CLIENT_SECRET: 'emitterClientSecretExample',
        IMS_PROMISE_EMITTER_DEFINITION_ID: 'promiseDefinitionIdExample',
        IMS_PROMISE_CONSUMER_CLIENT_ID: 'consumerClientIdExample',
        IMS_PROMISE_CONSUMER_CLIENT_SECRET: 'consumerClientSecretExample',
      },
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('constructor and createFrom', () => {
    it('throws errors for missing configuration using createFrom', () => {
      const expectedError = 'Context param must include properties: imsHost, clientId, and clientSecret and for EMITTER type also promiseDefinitionId.';
      expect(() => ImsPromiseClient.createFrom({
        env: {},
        log: console,
      }, ImsPromiseClient.CLIENT_TYPE.EMITTER)).to.throw(expectedError);
      expect(() => ImsPromiseClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
        },
        log: console,
      }, ImsPromiseClient.CLIENT_TYPE.CONSUMER)).to.throw(expectedError);
      expect(() => ImsPromiseClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_PROMISE_EMITTER_CLIENT_ID: 'clientIdExample',
          IMS_PROMISE_EMITTER_CLIENT_SECRET: 'clientCodeExample',
          IMS_PROMISE_EMITTER_DEFINITION_ID: 'promiseDefinitionIdExample',
        },
        log: console,
      }, ImsPromiseClient.CLIENT_TYPE.CONSUMER)).to.throw(expectedError);
      expect(() => ImsPromiseClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_PROMISE_CONSUMER_CLIENT_ID: 'clientIdExample',
          IMS_PROMISE_CONSUMER_CLIENT_SECRET: 'clientCodeExample',
        },
        log: console,
      }, ImsPromiseClient.CLIENT_TYPE.EMITTER)).to.throw(expectedError);
      expect(() => ImsPromiseClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_PROMISE_CONSUMER_CLIENT_ID: 'clientIdExample',
          IMS_PROMISE_CONSUMER_CLIENT_SECRET: 'clientCodeExample',
        },
        log: console,
      }, 'randomtype')).to.throw('Unknown IMS promise client type.');
    });
  });

  describe('createFrom pair selector', () => {
    const testAccessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1IiwidHlwZSI6ImFjY2Vzc190b2tlbiIsImNsaWVudF9pZCI6ImV4YW1wbGVfYXBwIiwidXNlcl9pZCI6Ijk4NzY1NDc4OTBBQkNERUYxMjM0NTY3OEBhYmNkZWYxMjM0NTY3ODkuZSIsImFzIjoiaW1zLW5hMSIsImFhX2lkIjoiMTIzNDU2Nzg5MEFCQ0RFRjEyMzQ1Njc4QGFkb2JlLmNvbSIsImNyZWF0ZWRfYXQiOiIxNzEwMjQ3MDAwMDAwIn0.MRDpxgxSHDj4DmA182hPnjMAnKkly-VUJ_bXpQ-J8EQ';
    let semrushContext;

    beforeEach(() => {
      semrushContext = {
        log: console,
        env: {
          IMS_HOST: DUMMY_HOST,
          IMS_PROMISE_SEMRUSH_EMITTER_CLIENT_ID: 'semrushEmitterClientId',
          IMS_PROMISE_SEMRUSH_EMITTER_CLIENT_SECRET: 'semrushEmitterClientSecret',
          IMS_PROMISE_SEMRUSH_EMITTER_DEFINITION_ID: 'semrushDefinitionId',
          IMS_PROMISE_SEMRUSH_CONSUMER_CLIENT_ID: 'semrushConsumerClientId',
          IMS_PROMISE_SEMRUSH_CONSUMER_CLIENT_SECRET: 'semrushConsumerClientSecret',
        },
      };
    });

    it('defaults to the unprefixed pair when no selector is given', () => {
      // mockContext holds only unprefixed env vars, so these succeed only if
      // the default (unprefixed) names are read.
      expect(() => ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      )).to.not.throw();
      expect(() => ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
        {},
      )).to.not.throw();
    });

    it('throws for an unknown pair', () => {
      expect(() => ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
        { pair: 'BOGUS' },
      )).to.throw('Unknown IMS promise client pair: BOGUS');
    });

    it('resolves the SEMRUSH emitter env vars', () => {
      // semrushContext has no unprefixed vars, so this succeeds only if the
      // IMS_PROMISE_SEMRUSH_EMITTER_* names are read.
      expect(() => ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
        { pair: ImsPromiseClient.PROMISE_PAIR.SEMRUSH },
      )).to.not.throw();
    });

    it('does not read the SEMRUSH env vars without the selector', () => {
      // semrushContext has only prefixed vars; without the selector the default
      // (unprefixed) names resolve to nothing, so construction must throw. This
      // documents that the prefix routing is load-bearing.
      expect(() => ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      )).to.throw('Context param must include properties');
    });

    it('resolves the SEMRUSH consumer env vars', () => {
      expect(() => ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
        { pair: ImsPromiseClient.PROMISE_PAIR.SEMRUSH },
      )).to.not.throw();
    });

    it('throws when a required SEMRUSH env var is missing', () => {
      delete semrushContext.env.IMS_PROMISE_SEMRUSH_EMITTER_CLIENT_ID;
      expect(() => ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
        { pair: ImsPromiseClient.PROMISE_PAIR.SEMRUSH },
      )).to.throw('Context param must include properties');
    });

    it('mints using the SEMRUSH emitter client id and definition id', async () => {
      nock(`https://${DUMMY_HOST}`)
        .post(
          IMS_TOKEN_ENDPOINT,
          (body) => body.match('name="client_id"\r\n\r\nsemrushEmitterClientId')
            && body.match('name="promise_definition_id"\r\n\r\nsemrushDefinitionId'),
        )
        .reply(200, {
          promise_token: 'semrushPromiseToken',
          token_type: 'promise_token',
          expires_in: 14399,
        });

      const client = ImsPromiseClient.createFrom(
        semrushContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
        { pair: ImsPromiseClient.PROMISE_PAIR.SEMRUSH },
      );
      const result = await client.getPromiseToken(testAccessToken);
      expect(result).to.deep.equal({
        promise_token: 'semrushPromiseToken',
        token_type: 'promise_token',
        expires_in: 14399,
      });
    });
  });

  describe('getPromiseToken', () => {
    const testAccessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1IiwidHlwZSI6ImFjY2Vzc190b2tlbiIsImNsaWVudF9pZCI6ImV4YW1wbGVfYXBwIiwidXNlcl9pZCI6Ijk4NzY1NDc4OTBBQkNERUYxMjM0NTY3OEBhYmNkZWYxMjM0NTY3ODkuZSIsImFzIjoiaW1zLW5hMSIsImFhX2lkIjoiMTIzNDU2Nzg5MEFCQ0RFRjEyMzQ1Njc4QGFkb2JlLmNvbSIsImNyZWF0ZWRfYXQiOiIxNzEwMjQ3MDAwMDAwIn0.MRDpxgxSHDj4DmA182hPnjMAnKkly-VUJ_bXpQ-J8EQ';
    let emitterClient;

    beforeEach(() => {
      emitterClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      );

      nock(`https://${DUMMY_HOST}`)
        .post(
          IMS_TOKEN_ENDPOINT,
          (body) => body.grant_type === 'promise'
            && body.promise_definition_id === 'promiseDefinitionIdExample'
            && body.authenticating_token === testAccessToken,
        )
        .reply(200, {
          scope: 'AdobeID,openid,read_organizations,additional_info.projectedProductContext',
          promise_token: 'promiseTokenExample',
          token_type: 'promise_token',
          expires_in: 14399,
        })
        .post(
          IMS_TOKEN_ENDPOINT,
          (body) => body.grant_type === 'promise'
            && body.promise_definition_id === 'promiseDefinitionIdExample'
            && body.authenticating_token !== testAccessToken,
        )
        .reply(401, {
          error: 'invalid_authenticating_token',
          error_description: 'Authenticating token invalid or expired',
        });
    });

    it('should succeed for a valid token', async () => {
      const result = await emitterClient.getPromiseToken(testAccessToken);
      await expect(result).to.deep.equal({
        promise_token: 'promiseTokenExample',
        token_type: 'promise_token',
        expires_in: 14399,
      });
    });

    it('should fail for consumer client type', async () => {
      const consumerClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );
      await expect(consumerClient.getPromiseToken(testAccessToken)).to.be.rejectedWith('Consumer type does not support getPromiseToken method.');
    });

    it('should fail for an invalid token', async () => {
      const invalidToken = 'invalidToken';
      await expect(emitterClient.getPromiseToken(invalidToken)).to.be.rejectedWith('IMS getPromiseToken request failed with status: 401');
    });

    it('should fail with encryption enabled', async () => {
      await expect(emitterClient.getPromiseToken(testAccessToken, true)).to.be.rejectedWith('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
    });

    it('should succeed for a valid token with encryption', async () => {
      mockContext.env.AUTOFIX_CRYPT_SECRET = 'secret';
      mockContext.env.AUTOFIX_CRYPT_SALT = 'salt';

      const emitterClientWithEncryption = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      );

      const result = await emitterClientWithEncryption.getPromiseToken(testAccessToken, true);
      expect(result).to.have.property('promise_token');
      expect(result.promise_token).to.match(/^[0-9a-f]*::[0-9a-f]*::[0-9a-f]*$/);
      expect(result).to.have.property('expires_in', 14399);
      expect(result).to.have.property('token_type', 'promise_token');
    });
  });

  describe('exchangeToken', () => {
    const testToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1IiwidHlwZSI6ImFjY2Vzc190b2tlbiIsImNsaWVudF9pZCI6ImV4YW1wbGVfYXBwIiwidXNlcl9pZCI6Ijk4NzY1NDc4OTBBQkNERUYxMjM0NTY3OEBhYmNkZWYxMjM0NTY3ODkuZSIsImFzIjoiaW1zLW5hMSIsImFhX2lkIjoiMTIzNDU2Nzg5MEFCQ0RFRjEyMzQ1Njc4QGFkb2JlLmNvbSIsImNyZWF0ZWRfYXQiOiIxNzEwMjQ3MDAwMDAwIn0.MRDpxgxSHDj4DmA182hPnjMAnKkly-VUJ_bXpQ-J8EQ';
    let consumerClient;

    beforeEach(() => {
      consumerClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );

      nock(`https://${DUMMY_HOST}`)
        .post(
          IMS_TOKEN_ENDPOINT,
          (body) => body.grant_type === 'promise_exchange'
            && body.promise_token === testToken,
        )
        .reply(200, {
          scope: 'AdobeID,openid,read_organizations,additional_info.projectedProductContext',
          access_token: 'accessTokenExample',
          token_type: 'access_token',
          expires_in: 299,
          promise_token_id: '1742399492824_fea6e0bd-2eb0-4bbe-adfd-ddb4296068ed_uw2',
          promise_token: testToken,
          promise_token_expires_in: 14399,
        })
        .post(
          IMS_TOKEN_ENDPOINT,
          (body) => body.grant_type === 'promise_exchange'
            && body.authenticating_token !== testToken,
        )
        .reply(401, {
          error: 'invalid_promise_token',
          error_description: 'Promise token invalid, invalidated or expired.',
        });
    });

    it('should succeed for a valid token', async () => {
      const result = await consumerClient.exchangeToken(testToken);
      await expect(result).to.deep.equal({
        access_token: 'accessTokenExample',
        token_type: 'access_token',
        expires_in: 299,
        promise_token: testToken,
        promise_token_expires_in: 14399,
      });
    });

    it('should fail for consumer client type', async () => {
      const emitterClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.EMITTER,
      );
      await expect(emitterClient.exchangeToken(testToken)).to.be.rejectedWith('Emitter type does not support exchangeToken method.');
    });

    it('should fail for an invalid token', async () => {
      const invalidToken = 'invalidToken';
      await expect(consumerClient.exchangeToken(invalidToken)).to.be.rejectedWith('IMS exchangeToken request failed with status: 401');
    });

    it('should fail with encryption enabled', async () => {
      await expect(consumerClient.exchangeToken(testToken, true)).to.be.rejectedWith('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
    });

    it('should succeed for a valid token with encryption', async () => {
      mockContext.env.AUTOFIX_CRYPT_SECRET = 'secret';
      mockContext.env.AUTOFIX_CRYPT_SALT = 'salt';

      const consumerClientWithEncryption = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );

      const encryptedTestToken = await encrypt({
        secret: mockContext.env.AUTOFIX_CRYPT_SECRET,
        salt: mockContext.env.AUTOFIX_CRYPT_SALT,
      }, testToken);

      const result = await consumerClientWithEncryption.exchangeToken(encryptedTestToken, true);
      expect(result).to.have.property('promise_token');
      expect(result.promise_token).to.match(/^[0-9a-f]*::[0-9a-f]*::[0-9a-f]*$/);
      expect(result).to.have.property('access_token', 'accessTokenExample');
      expect(result).to.have.property('expires_in', 299);
      expect(result).to.have.property('token_type', 'access_token');
      expect(result).to.have.property('promise_token_expires_in', 14399);
    });
  });

  describe('invalidatePromiseToken', () => {
    const testToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1IiwidHlwZSI6ImFjY2Vzc190b2tlbiIsImNsaWVudF9pZCI6ImV4YW1wbGVfYXBwIiwidXNlcl9pZCI6Ijk4NzY1NDc4OTBBQkNERUYxMjM0NTY3OEBhYmNkZWYxMjM0NTY3ODkuZSIsImFzIjoiaW1zLW5hMSIsImFhX2lkIjoiMTIzNDU2Nzg5MEFCQ0RFRjEyMzQ1Njc4QGFkb2JlLmNvbSIsImNyZWF0ZWRfYXQiOiIxNzEwMjQ3MDAwMDAwIn0.MRDpxgxSHDj4DmA182hPnjMAnKkly-VUJ_bXpQ-J8EQ';
    let consumerClient;

    beforeEach(() => {
      consumerClient = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );

      nock(`https://${DUMMY_HOST}`)
        .post(
          IMS_INVALIDATE_TOKEN_ENDPOINT,
          (body) => body.token_type === 'promise_token'
            && body.token === testToken,
        )
        .reply(200)
        .post(
          IMS_INVALIDATE_TOKEN_ENDPOINT,
          (body) => body.token_type === 'promise_token'
            && body.token !== testToken,
        )
        .reply(400, {
          error: 'invalid_parameter_value',
          error_description: 'Invalid or expired token.',
        });
    });

    it('should succeed for a valid token', async () => {
      expect(consumerClient.invalidatePromiseToken(testToken)).to.be.eventually.fulfilled;
    });

    it('should fail for an invalid token', async () => {
      const invalidToken = 'invalidToken';
      await expect(consumerClient.invalidatePromiseToken(invalidToken)).to.be.rejectedWith('IMS invalidatePromiseToken request failed with status: 400');
    });

    it('should fail with encryption enabled', async () => {
      await expect(consumerClient.invalidatePromiseToken(testToken, true)).to.be.rejectedWith('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
    });

    it('should succeed for a valid token with encryption', async () => {
      mockContext.env.AUTOFIX_CRYPT_SECRET = 'secret';
      mockContext.env.AUTOFIX_CRYPT_SALT = 'salt';

      const clientWithEncryption = ImsPromiseClient.createFrom(
        mockContext,
        ImsPromiseClient.CLIENT_TYPE.CONSUMER,
      );

      const encryptedTestToken = await encrypt({
        secret: mockContext.env.AUTOFIX_CRYPT_SECRET,
        salt: mockContext.env.AUTOFIX_CRYPT_SALT,
      }, testToken);

      const result = clientWithEncryption.invalidatePromiseToken(encryptedTestToken, true);
      expect(result).to.be.eventually.fulfilled;
    });
  });
});
