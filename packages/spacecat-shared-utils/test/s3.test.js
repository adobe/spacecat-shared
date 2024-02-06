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

// Import necessary libraries
import { expect } from 'chai';
import sinon from 'sinon';
import { S3Client } from '@aws-sdk/client-s3';
import { s3Bucket } from '../src/s3.js';

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
    await s3Bucket(fakeFn)(fakeReq, fakeContext);

    expect(fakeContext).to.have.property('s3').that.is.instanceof(S3Client);
    expect(fakeContext).to.have.property('s3Bucket', 'test-bucket');
    sinon.assert.calledOnce(fakeFn);
    sinon.assert.calledWith(fakeFn, fakeReq, fakeContext);
  });

  it('should not initialize S3 client if already present in context', async () => {
    // Pre-set the S3 client in the context to simulate it already being initialized
    const s3Client = new S3Client({ region: 'us-test-1' });
    fakeContext.s3 = s3Client;

    await s3Bucket(fakeFn)(fakeReq, fakeContext);

    expect(fakeContext.s3).to.equal(s3Client); // Ensure the original s3 client was not overwritten
    sinon.assert.calledOnce(fakeFn);
    sinon.assert.calledWith(fakeFn, fakeReq, fakeContext);
  });

  // Add more tests as necessary to cover different cases and scenarios
});
