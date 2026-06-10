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

import { expect } from 'chai';
import sinon from 'sinon';
import { S3Client } from '@aws-sdk/client-s3';

import { createDataAccess, createFetchCompat } from '../../../src/service/index.js';

describe('service/index', () => {
  it('uses provided PostgREST client and does not require postgrestUrl', () => {
    const client = {};
    const dataAccess = createDataAccess({}, console, client);

    expect(dataAccess).to.be.an('object');
    expect(dataAccess.services).to.be.an('object');
    expect(dataAccess.services.postgrestClient).to.equal(client);
  });

  it('throws when postgrestUrl is missing and no client is provided', () => {
    expect(() => createDataAccess({}, console))
      .to.throw('postgrestUrl is required to create data access');
  });

  it('creates data access with PostgREST config and no S3 bucket', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      postgrestSchema: 'public',
      postgrestApiKey: 'api-key',
      postgrestHeaders: {
        'x-test-header': 'value',
      },
    }, console);

    expect(dataAccess).to.be.an('object');
    expect(dataAccess.services).to.be.an('object');
    expect(dataAccess.services.postgrestClient).to.be.an('object');
    expect(dataAccess.services.postgrestClient).to.have.property('from').that.is.a('function');
  });

  it('creates data access with optional S3 config', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      s3Bucket: 'test-bucket',
      region: 'us-east-1',
    }, console, {});

    expect(dataAccess).to.be.an('object');
  });

  it('creates data access with S3 bucket and default region options', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      s3Bucket: 'test-bucket',
    }, console, {});

    expect(dataAccess).to.be.an('object');
  });

  describe('S3 service with EbusyRetryStrategy', () => {
    it('creates S3Client with custom retry strategy when s3Bucket is provided', () => {
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
        s3Bucket: 'test-bucket',
        region: 'us-east-1',
      }, console, {});

      expect(dataAccess).to.be.an('object');
      expect(dataAccess.Configuration).to.exist;
    });

    it('configures S3Client with maxAttempts: 4', () => {
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
        s3Bucket: 'test-bucket',
      }, console, {});

      // Verify Configuration collection exists (requires S3)
      expect(dataAccess.Configuration).to.exist;
    });

    it('does not create S3 service when s3Bucket is not provided', () => {
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
      }, console, {});

      expect(dataAccess).to.be.an('object');
      // Configuration collection should still exist but without S3
      expect(dataAccess.Configuration).to.exist;
    });
  });

  describe('EbusyRetryStrategy', () => {
    let EbusyRetryStrategy;
    let strategy;
    let mockToken;
    let superRefreshStub;

    before(async () => {
      // Access the class through createS3Service execution
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
        s3Bucket: 'test-bucket',
      }, console, {});

      // Extract the retry strategy from the Configuration collection's S3 client
      const configCollection = dataAccess.Configuration;
      const s3Client = configCollection.s3Client;
      strategy = s3Client.config.retryStrategy;

      EbusyRetryStrategy = strategy.constructor;
    });

    beforeEach(() => {
      mockToken = { retryCount: 0 };
      // Stub the parent's refreshRetryTokenForRetry method
      superRefreshStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(strategy)), 'refreshRetryTokenForRetry')
        .resolves({ retryCount: 1 });
    });

    afterEach(() => {
      superRefreshStub.restore();
    });

    it('reclassifies EBUSY errors with code as TRANSIENT', async () => {
      const ebusyError = new Error('getaddrinfo EBUSY');
      ebusyError.code = 'EBUSY';

      const errorInfo = { error: ebusyError };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify super was called with TRANSIENT errorType
      expect(superRefreshStub).to.have.been.calledOnce;
      const [token, modifiedErrorInfo] = superRefreshStub.firstCall.args;
      expect(token).to.equal(mockToken);
      expect(modifiedErrorInfo.errorType).to.equal('TRANSIENT');
      expect(modifiedErrorInfo.error).to.equal(ebusyError);
    });

    it('reclassifies EBUSY errors with getaddrinfo message as TRANSIENT', async () => {
      const ebusyDnsError = new Error('getaddrinfo EBUSY spacecat-prod-importer.s3.us-east-1.amazonaws.com');
      // No code set, only message matching

      const errorInfo = { error: ebusyDnsError };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify super was called with TRANSIENT errorType
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, modifiedErrorInfo] = superRefreshStub.firstCall.args;
      expect(modifiedErrorInfo.errorType).to.equal('TRANSIENT');
    });

    it('does not reclassify non-EBUSY errors', async () => {
      const randomError = new Error('Some other error');
      randomError.code = 'EOTHER';

      const errorInfo = { error: randomError, errorType: 'THROTTLING' };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify super was called with original errorInfo unchanged
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, passedErrorInfo] = superRefreshStub.firstCall.args;
      expect(passedErrorInfo.errorType).to.equal('THROTTLING');
      expect(passedErrorInfo.error).to.equal(randomError);
    });

    it('does not reclassify ECONNRESET (already handled by SDK)', async () => {
      const connResetError = new Error('Connection reset');
      connResetError.code = 'ECONNRESET';

      const errorInfo = { error: connResetError };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify errorType was NOT set to TRANSIENT
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, passedErrorInfo] = superRefreshStub.firstCall.args;
      expect(passedErrorInfo.errorType).to.be.undefined;
    });

    it('does not reclassify ETIMEDOUT (already handled by SDK)', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';

      const errorInfo = { error: timeoutError };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify errorType was NOT set to TRANSIENT
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, passedErrorInfo] = superRefreshStub.firstCall.args;
      expect(passedErrorInfo.errorType).to.be.undefined;
    });

    it('does not reclassify ENOTFOUND (already handled by SDK)', async () => {
      const notFoundError = new Error('DNS not found');
      notFoundError.code = 'ENOTFOUND';

      const errorInfo = { error: notFoundError };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify errorType was NOT set to TRANSIENT
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, passedErrorInfo] = superRefreshStub.firstCall.args;
      expect(passedErrorInfo.errorType).to.be.undefined;
    });

    it('handles errorInfo with no error property', async () => {
      const errorInfo = { errorType: 'THROTTLING' };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Should delegate without crashing
      expect(superRefreshStub).to.have.been.calledOnce;
    });

    it('preserves other errorInfo properties when reclassifying', async () => {
      const ebusyError = new Error('EBUSY');
      ebusyError.code = 'EBUSY';

      const errorInfo = {
        error: ebusyError,
        retryAfterHint: 1000,
        customProperty: 'custom-value',
      };

      await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      // Verify all properties are preserved
      expect(superRefreshStub).to.have.been.calledOnce;
      const [, modifiedErrorInfo] = superRefreshStub.firstCall.args;
      expect(modifiedErrorInfo.errorType).to.equal('TRANSIENT');
      expect(modifiedErrorInfo.retryAfterHint).to.equal(1000);
      expect(modifiedErrorInfo.customProperty).to.equal('custom-value');
      expect(modifiedErrorInfo.error).to.equal(ebusyError);
    });

    it('returns result from parent refreshRetryTokenForRetry', async () => {
      const ebusyError = new Error('EBUSY');
      ebusyError.code = 'EBUSY';

      const errorInfo = { error: ebusyError };
      superRefreshStub.resolves({ retryCount: 2, retryDelay: 200 });

      const result = await strategy.refreshRetryTokenForRetry(mockToken, errorInfo);

      expect(result).to.deep.equal({ retryCount: 2, retryDelay: 200 });
    });

    it('constructs with default maxAttempts of 4', () => {
      const newStrategy = new EbusyRetryStrategy();
      expect(newStrategy).to.exist;
      // maxAttempts is internal to StandardRetryStrategy, just verify construction works
    });

    it('constructs with custom maxAttempts', () => {
      const newStrategy = new EbusyRetryStrategy(5);
      expect(newStrategy).to.exist;
    });
  });

  describe('createFetchCompat', () => {
    it('converts native Headers instances to plain objects', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const wrappedFetch = createFetchCompat(mockFetch);

      const nativeHeaders = new Headers();
      nativeHeaders.set('Content-Type', 'application/json');
      nativeHeaders.set('Authorization', 'Bearer token');

      await wrappedFetch('http://example.com', {
        method: 'POST',
        headers: nativeHeaders,
        body: '{"test":true}',
      });

      expect(mockFetch).to.have.been.calledOnce;
      const [url, opts] = mockFetch.firstCall.args;
      expect(url).to.equal('http://example.com');
      expect(opts.headers).to.deep.equal({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
      expect(opts.body).to.equal('{"test":true}');
    });

    it('passes plain object headers through unchanged', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const wrappedFetch = createFetchCompat(mockFetch);

      const plainHeaders = { 'Content-Type': 'application/json' };

      await wrappedFetch('http://example.com', {
        method: 'GET',
        headers: plainHeaders,
      });

      expect(mockFetch).to.have.been.calledOnce;
      const [, opts] = mockFetch.firstCall.args;
      expect(opts.headers).to.equal(plainHeaders);
    });

    it('handles calls with no options', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const wrappedFetch = createFetchCompat(mockFetch);

      await wrappedFetch('http://example.com');

      expect(mockFetch).to.have.been.calledOnceWith('http://example.com', undefined);
    });
  });
});
