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

/* eslint-env mocha */

import { expect } from 'chai';
import sinon from 'sinon';

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
