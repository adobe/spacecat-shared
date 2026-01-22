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

import { expect } from 'chai';
import sinon from 'sinon';
import { S3Client } from '@aws-sdk/client-s3';
import { s3Wrapper, getObjectFromKey } from '../src/s3.js';

describe('getObjectFromKey', () => {
  let s3Client;
  let log;

  beforeEach(() => {
    s3Client = {
      send: sinon.stub(),
    };
    log = {
      error: sinon.stub(),
    };
  });

  it('should retrieve and parse JSON object from S3', async () => {
    const mockData = { key: 'value', nested: { data: 123 } };
    s3Client.send.resolves({
      ContentType: 'application/json',
      Body: {
        transformToString: sinon.stub().resolves(JSON.stringify(mockData)),
      },
    });

    const result = await getObjectFromKey(s3Client, 'test-bucket', 'test-key', log);

    expect(result).to.deep.equal(mockData);
    expect(log.error).to.not.have.been.called;
  });

  it('should return raw body for non-JSON content', async () => {
    const textContent = 'plain text content';
    s3Client.send.resolves({
      ContentType: 'text/plain',
      Body: {
        transformToString: sinon.stub().resolves(textContent),
      },
    });

    const result = await getObjectFromKey(s3Client, 'test-bucket', 'test-key', log);

    expect(result).to.equal(textContent);
    expect(log.error).to.not.have.been.called;
  });

  it('should return null when S3 object is not found', async () => {
    const error = new Error('NoSuchKey');
    error.name = 'NoSuchKey';
    s3Client.send.rejects(error);

    const result = await getObjectFromKey(s3Client, 'test-bucket', 'test-key', log);

    expect(result).to.be.null;
    expect(log.error).to.have.been.calledWith('Error while fetching S3 object from bucket test-bucket using key test-key');
  });

  it('should return null and log error when JSON parsing fails', async () => {
    s3Client.send.resolves({
      ContentType: 'application/json',
      Body: {
        transformToString: sinon.stub().resolves('invalid json{'),
      },
    });

    const result = await getObjectFromKey(s3Client, 'test-bucket', 'test-key', log);

    expect(result).to.be.null;
    expect(log.error).to.have.been.calledWith('Unable to parse content for key test-key');
  });

  it('should return null when invalid parameters are provided', async () => {
    const result1 = await getObjectFromKey(null, 'test-bucket', 'test-key', log);
    expect(result1).to.be.null;
    expect(log.error).to.have.been.calledWith('Invalid input parameters in getObjectFromKey: ensure s3Client, bucketName, and key are provided.');

    log.error.resetHistory();

    const result2 = await getObjectFromKey(s3Client, null, 'test-key', log);
    expect(result2).to.be.null;
    expect(log.error).to.have.been.calledWith('Invalid input parameters in getObjectFromKey: ensure s3Client, bucketName, and key are provided.');

    log.error.resetHistory();

    const result3 = await getObjectFromKey(s3Client, 'test-bucket', null, log);
    expect(result3).to.be.null;
    expect(log.error).to.have.been.calledWith('Invalid input parameters in getObjectFromKey: ensure s3Client, bucketName, and key are provided.');
  });

  it('should handle S3 errors gracefully', async () => {
    const error = new Error('AccessDenied');
    error.name = 'AccessDenied';
    s3Client.send.rejects(error);

    const result = await getObjectFromKey(s3Client, 'test-bucket', 'test-key', log);

    expect(result).to.be.null;
    expect(log.error).to.have.been.calledWith('Error while fetching S3 object from bucket test-bucket using key test-key');
  });
});

describe('S3 wrapper', () => {
  let fakeContext;
  let fakeReq;
  let fakeFn;

  beforeEach(() => {
    fakeContext = {
      env: {
        AWS_REGION: 'us-test-1',
        S3_BUCKET_NAME: 'test-bucket',
      },
    };
    fakeReq = {};
    fakeFn = sinon.stub().resolves('test response');

    sinon.stub(S3Client.prototype, 'constructor').callsFake(() => {});
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should initialize S3 client and bucket name in context if not present', async () => {
    await s3Wrapper(fakeFn)(fakeReq, fakeContext);

    expect(fakeContext).to.have.property('s3').that.is.an('object');
    expect(fakeContext.s3).to.have.property('s3Client').that.is.instanceof(S3Client);
    expect(fakeContext.s3).to.have.property('s3Bucket', 'test-bucket');
    sinon.assert.calledOnce(fakeFn);
    sinon.assert.calledWith(fakeFn, fakeReq, fakeContext);
  });

  it('should not initialize S3 client if already present in context', async () => {
    // Pre-set the S3 client in the context to simulate it already being initialized
    const s3Client = new S3Client({ region: 'us-test-1' });
    fakeContext.s3 = { s3Client };

    await s3Wrapper(fakeFn)(fakeReq, fakeContext);

    // Ensure the original s3 client was not overwritten
    expect(fakeContext.s3.s3Client).to.equal(s3Client);
    sinon.assert.calledOnce(fakeFn);
    sinon.assert.calledWith(fakeFn, fakeReq, fakeContext);
  });
});
