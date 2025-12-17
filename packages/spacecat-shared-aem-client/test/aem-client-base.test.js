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
import { stub, useFakeTimers } from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import esmock from 'esmock';
import { AemConfigurationError } from '../src/index.js';

use(sinonChai);
use(chaiAsPromised);

describe('AemBaseClient', () => {
  let AemBaseClient;
  let tracingFetchStub;
  let logStub;
  let mockImsClient;
  let ImsClientStub;

  const createMockImsClient = (accessToken = 'test-token', expiresIn = 3600) => ({
    getServiceAccessToken: stub().resolves({
      access_token: accessToken,
      expires_in: expiresIn,
    }),
  });

  beforeEach(async () => {
    tracingFetchStub = stub();
    logStub = {
      info: stub(),
      error: stub(),
    };
    mockImsClient = createMockImsClient();
    ImsClientStub = {
      createFrom: stub().returns(mockImsClient),
    };

    const module = await esmock(
      '../src/aem-client-base.js',
      {
        '@adobe/spacecat-shared-utils': {
          tracingFetch: tracingFetchStub,
        },
        '@adobe/spacecat-shared-ims-client': {
          ImsClient: ImsClientStub,
        },
      },
    );
    AemBaseClient = module.AemBaseClient;
  });

  describe('constructor', () => {
    it('should create client with valid baseUrl and imsClient', () => {
      const client = new AemBaseClient('https://author.example.com', mockImsClient, logStub);

      expect(client.baseUrl).to.equal('https://author.example.com');
      expect(client.imsClient).to.equal(mockImsClient);
      expect(client.log).to.equal(logStub);
    });

    it('should initialize token state as null', () => {
      const client = new AemBaseClient('https://author.example.com', mockImsClient, logStub);

      expect(client.accessToken).to.be.null;
      expect(client.tokenObtainedAt).to.be.null;
    });

    it('should throw AemConfigurationError when baseUrl is missing', () => {
      expect(() => new AemBaseClient(null, mockImsClient))
        .to.throw(AemConfigurationError);
    });

    it('should throw AemConfigurationError when baseUrl is empty string', () => {
      expect(() => new AemBaseClient('', mockImsClient))
        .to.throw(AemConfigurationError);
    });

    it('should throw AemConfigurationError when imsClient is missing', () => {
      expect(() => new AemBaseClient('https://author.example.com', null))
        .to.throw(AemConfigurationError);
    });

    it('should use console as default logger', () => {
      const client = new AemBaseClient('https://author.example.com', mockImsClient);
      expect(client.log).to.equal(console);
    });
  });

  describe('createFrom', () => {
    it('should create client from context with valid configuration', () => {
      const context = {
        site: {
          getDeliveryConfig: () => ({ authorURL: 'https://author.example.com' }),
        },
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_CLIENT_ID: 'client-id',
          IMS_CLIENT_CODE: 'client-code',
          IMS_CLIENT_SECRET: 'client-secret',
          IMS_SCOPE: 'openid',
        },
        log: logStub,
      };

      const client = AemBaseClient.createFrom(context);

      expect(client).to.be.instanceOf(AemBaseClient);
      expect(client.baseUrl).to.equal('https://author.example.com');
      expect(client.imsClient).to.equal(mockImsClient);
      expect(ImsClientStub.createFrom).to.have.been.calledWith({
        log: logStub,
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_CLIENT_ID: 'client-id',
          IMS_CLIENT_CODE: 'client-code',
          IMS_CLIENT_SECRET: 'client-secret',
          IMS_SCOPE: 'openid',
        },
      });
    });

    it('should throw AemConfigurationError when authorURL is missing', () => {
      const context = {
        site: {
          getDeliveryConfig: () => ({}),
        },
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_CLIENT_ID: 'client-id',
          IMS_CLIENT_CODE: 'client-code',
          IMS_CLIENT_SECRET: 'client-secret',
          IMS_SCOPE: 'openid',
        },
        log: logStub,
      };

      expect(() => AemBaseClient.createFrom(context))
        .to.throw(AemConfigurationError);
    });
  });

  describe('request', () => {
    let client;

    beforeEach(() => {
      client = new AemBaseClient('https://author.example.com', mockImsClient, logStub);
    });

    it('should make GET request with correct headers', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await client.request('GET', '/api/test');

      expect(tracingFetchStub).to.have.been.calledWith(
        'https://author.example.com/api/test',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
      );
      expect(result).to.deep.equal({ data: 'test' });
    });

    it('should make POST request with body', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ created: true }),
      });

      const body = { title: 'Test Fragment' };
      await client.request('POST', '/api/fragments', body);

      expect(tracingFetchStub).to.have.been.calledWith(
        'https://author.example.com/api/fragments',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
    });

    it('should include additional headers', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({}),
      });

      await client.request('PATCH', '/api/test', { data: 'test' }, { 'If-Match': 'etag-123' });

      expect(tracingFetchStub).to.have.been.calledWith(
        'https://author.example.com/api/test',
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer test-token',
            'If-Match': 'etag-123',
          },
          body: JSON.stringify({ data: 'test' }),
        },
      );
    });

    it('should not include body for null body', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      });

      await client.request('GET', '/api/test', null);

      const callArgs = tracingFetchStub.firstCall.args[1];
      expect(callArgs).to.not.have.property('body');
    });

    it('should not include body for undefined body', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      });

      await client.request('GET', '/api/test', undefined);

      const callArgs = tracingFetchStub.firstCall.args[1];
      expect(callArgs).to.not.have.property('body');
    });

    it('should return null for non-JSON response', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: { get: () => 'text/plain' },
      });

      const result = await client.request('DELETE', '/api/test');

      expect(result).to.be.null;
    });

    it('should return null when content-type header is missing', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: { get: () => null },
      });

      const result = await client.request('DELETE', '/api/test');

      expect(result).to.be.null;
    });

    it('should capture ETag from response headers', async () => {
      tracingFetchStub.resolves({
        ok: true,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            if (name === 'ETag') return '"etag-value"';
            return null;
          },
        },
        json: () => Promise.resolve({ id: '123' }),
      });

      const result = await client.request('GET', '/api/test');

      expect(result).to.deep.equal({ id: '123', etag: '"etag-value"' });
    });

    it('should throw AemRequestError for failed response', async () => {
      tracingFetchStub.resolves({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.request('GET', '/api/test')).to.be.rejected;
    });

    it('should throw AemAuthenticationError for 401 response', async () => {
      tracingFetchStub.resolves({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      try {
        await client.request('GET', '/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.name).to.equal('AemAuthenticationError');
      }
    });

    it('should throw AemForbiddenError for 403 response', async () => {
      tracingFetchStub.resolves({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      try {
        await client.request('GET', '/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.name).to.equal('AemForbiddenError');
      }
    });

    it('should throw AemConflictError for 409 response', async () => {
      tracingFetchStub.resolves({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Conflict'),
      });

      try {
        await client.request('GET', '/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.name).to.equal('AemConflictError');
      }
    });

    it('should throw AemPreconditionFailedError for 412 response', async () => {
      tracingFetchStub.resolves({
        ok: false,
        status: 412,
        text: () => Promise.resolve('Precondition Failed'),
      });

      try {
        await client.request('GET', '/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.name).to.equal('AemPreconditionFailedError');
      }
    });
  });

  describe('token management', () => {
    let client;
    let clock;

    beforeEach(() => {
      client = new AemBaseClient('https://author.example.com', mockImsClient, logStub);
    });

    afterEach(() => {
      if (clock) {
        clock.restore();
      }
    });

    describe('getAccessToken', () => {
      it('should fetch new token when no token exists', async () => {
        const token = await client.getAccessToken();

        expect(mockImsClient.getServiceAccessToken).to.have.been.calledOnce;
        expect(token).to.equal('test-token');
      });

      it('should return cached token when not expired', async () => {
        await client.getAccessToken();
        await client.getAccessToken();

        expect(mockImsClient.getServiceAccessToken).to.have.been.calledOnce;
      });

      it('should fetch new token when previous token is expired', async () => {
        clock = useFakeTimers(Date.now());

        await client.getAccessToken();
        expect(mockImsClient.getServiceAccessToken).to.have.been.calledOnce;

        // Advance time beyond token expiry (3600 seconds = 3600000ms)
        clock.tick(3600001);

        await client.getAccessToken();
        expect(mockImsClient.getServiceAccessToken).to.have.been.calledTwice;
      });

      it('should update tokenObtainedAt when fetching new token', async () => {
        clock = useFakeTimers(1000000);

        await client.getAccessToken();

        expect(client.tokenObtainedAt).to.equal(1000000);
      });
    });

    describe('isTokenExpired', () => {
      it('should return true when accessToken is null', () => {
        expect(client.isTokenExpired()).to.be.true;
      });

      it('should return true when tokenObtainedAt is null', () => {
        client.accessToken = { access_token: 'token', expires_in: 3600 };
        expect(client.isTokenExpired()).to.be.true;
      });

      it('should return false when token is valid', async () => {
        await client.getAccessToken();
        expect(client.isTokenExpired()).to.be.false;
      });

      it('should return true when token has expired', async () => {
        clock = useFakeTimers(Date.now());

        await client.getAccessToken();
        expect(client.isTokenExpired()).to.be.false;

        clock.tick(3600001);
        expect(client.isTokenExpired()).to.be.true;
      });

      it('should invalidate token when expired', async () => {
        clock = useFakeTimers(Date.now());

        await client.getAccessToken();
        clock.tick(3600001);

        client.isTokenExpired();

        expect(client.accessToken).to.be.null;
        expect(client.tokenObtainedAt).to.be.null;
      });
    });

    describe('invalidateAccessToken', () => {
      it('should set accessToken and tokenObtainedAt to null', async () => {
        await client.getAccessToken();

        client.invalidateAccessToken();

        expect(client.accessToken).to.be.null;
        expect(client.tokenObtainedAt).to.be.null;
      });
    });
  });
});
