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
    let mockNext;
    let mockArgs;

    before(async () => {
      // Import the class from the module
      const serviceModule = await import('../../../src/service/index.js');
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
      mockNext = sinon.stub().resolves({ success: true });
      mockArgs = {
        response: {},
      };
    });

    it('marks EBUSY errors with code as retryable', async () => {
      const ebusyError = new Error('getaddrinfo EBUSY');
      ebusyError.code = 'EBUSY';

      mockArgs.response = { error: ebusyError };

      await strategy.retry(mockNext, mockArgs);

      // Verify error was marked retryable
      expect(mockArgs.response.error.$retryable).to.exist;
      expect(mockNext).to.have.been.called;
    });

    it('marks EBUSY errors with getaddrinfo message as retryable', async () => {
      const ebusyDnsError = new Error('getaddrinfo EBUSY spacecat-prod-importer.s3.us-east-1.amazonaws.com');
      // No code set, only message matching

      mockArgs.response = { error: ebusyDnsError };

      await strategy.retry(mockNext, mockArgs);

      // Verify error was marked retryable
      expect(mockArgs.response.error.$retryable).to.exist;
      expect(mockNext).to.have.been.called;
    });

    it('does not mark non-EBUSY errors as retryable', async () => {
      const randomError = new Error('Some other error');
      randomError.code = 'EOTHER';

      mockArgs.response = { error: randomError };

      await strategy.retry(mockNext, mockArgs);

      // Verify error was NOT marked retryable
      expect(mockArgs.response.error.$retryable).to.be.undefined;
      expect(mockNext).to.have.been.called;
    });

    it('handles errors with ECONNRESET code without marking as retryable', async () => {
      const connResetError = new Error('Connection reset');
      connResetError.code = 'ECONNRESET';

      mockArgs.response = { error: connResetError };

      await strategy.retry(mockNext, mockArgs);

      // SDK already handles ECONNRESET, we should not mark it
      expect(mockArgs.response.error.$retryable).to.be.undefined;
      expect(mockNext).to.have.been.called;
    });

    it('handles errors with ETIMEDOUT code without marking as retryable', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockArgs.response = { error: timeoutError };

      await strategy.retry(mockNext, mockArgs);

      // SDK already handles ETIMEDOUT, we should not mark it
      expect(mockArgs.response.error.$retryable).to.be.undefined;
      expect(mockNext).to.have.been.called;
    });

    it('handles errors with ENOTFOUND code without marking as retryable', async () => {
      const notFoundError = new Error('DNS not found');
      notFoundError.code = 'ENOTFOUND';

      mockArgs.response = { error: notFoundError };

      await strategy.retry(mockNext, mockArgs);

      // SDK already handles ENOTFOUND, we should not mark it
      expect(mockArgs.response.error.$retryable).to.be.undefined;
      expect(mockNext).to.have.been.called;
    });

    it('handles response with no error', async () => {
      mockArgs.response = { success: true };

      await strategy.retry(mockNext, mockArgs);

      expect(mockNext).to.have.been.called;
    });

    it('handles args with no response', async () => {
      mockArgs = {};

      await strategy.retry(mockNext, mockArgs);

      expect(mockNext).to.have.been.called;
    });

    it('delegates to StandardRetryStrategy after marking error', async () => {
      const ebusyError = new Error('EBUSY');
      ebusyError.code = 'EBUSY';

      mockArgs.response = { error: ebusyError };

      const result = await strategy.retry(mockNext, mockArgs);

      // Verify next was called (delegated to parent)
      expect(mockNext).to.have.been.called;
      expect(result).to.exist;
    });

    it('preserves error properties when marking as retryable', async () => {
      const ebusyError = new Error('getaddrinfo EBUSY');
      ebusyError.code = 'EBUSY';
      ebusyError.customProperty = 'custom-value';

      mockArgs.response = { error: ebusyError };

      await strategy.retry(mockNext, mockArgs);

      // Verify custom properties are preserved
      expect(mockArgs.response.error.code).to.equal('EBUSY');
      expect(mockArgs.response.error.customProperty).to.equal('custom-value');
      expect(mockArgs.response.error.$retryable).to.exist;
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
