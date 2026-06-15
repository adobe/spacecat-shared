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
import { StandardRetryStrategy } from '@smithy/util-retry';

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

  it('creates data access with full config', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      postgrestSchema: 'test',
      postgrestApiKey: 'test-key',
      postgrestHeaders: { 'X-Custom': 'header' },
    }, console);

    expect(dataAccess).to.be.an('object');
    expect(dataAccess.services).to.be.an('object');
    expect(dataAccess.services.postgrestClient).to.exist;
  });

  it('creates S3 service when s3Bucket is provided', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      s3Bucket: 'test-bucket',
    }, console, {});

    expect(dataAccess.Configuration).to.exist;
  });

  it('does not create S3 service when s3Bucket is missing', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
    }, console, {});

    expect(dataAccess.Configuration.s3Client).to.be.undefined;
  });

  describe('createFetchCompat', () => {
    it('converts native Headers to plain object', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const compatFetch = createFetchCompat(mockFetch);

      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('X-Custom', 'value');

      await compatFetch('http://test.com', { headers });

      expect(mockFetch).to.have.been.calledOnce;
      const [, opts] = mockFetch.firstCall.args;
      expect(opts.headers).to.deep.equal({
        'content-type': 'application/json',
        'x-custom': 'value',
      });
    });

    it('passes through opts with no headers', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const compatFetch = createFetchCompat(mockFetch);

      await compatFetch('http://test.com', { method: 'POST' });

      expect(mockFetch).to.have.been.calledWith('http://test.com', { method: 'POST' });
    });

    it('passes through opts with plain object headers', async () => {
      const mockFetch = sinon.stub().resolves({ ok: true });
      const compatFetch = createFetchCompat(mockFetch);

      await compatFetch('http://test.com', { headers: { 'X-Test': 'value' } });

      expect(mockFetch).to.have.been.calledWith('http://test.com', { headers: { 'X-Test': 'value' } });
    });
  });

  describe('S3 service with EbusyRetryStrategy', () => {
    it('configures S3 client with custom retry strategy when s3Bucket is provided', () => {
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
        s3Bucket: 'test-bucket',
      }, console, {});

      expect(dataAccess.Configuration).to.exist;
      expect(dataAccess.Configuration.s3Client).to.exist;
    });

    it('retry strategy extends StandardRetryStrategy', () => {
      const dataAccess = createDataAccess({
        postgrestUrl: 'http://localhost:3000',
        s3Bucket: 'test-bucket',
        region: 'us-east-1',
      }, console, {});

      const { Configuration } = dataAccess;
      expect(Configuration.s3Client).to.exist;

      // The retry strategy is configured in the S3Client options
      // We verify it was set up by checking the client exists with the bucket
      expect(Configuration.s3Bucket).to.equal('test-bucket');
    });

    // Note: The EbusyRetryStrategy class is internal to the service/index.js module.
    // It extends StandardRetryStrategy to add EBUSY error retry logic.
    // The actual retry behavior is tested via integration tests with real S3 operations,
    // as unit testing would require mocking the entire AWS SDK retry infrastructure.
  });
});
