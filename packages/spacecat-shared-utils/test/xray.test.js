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

import sinon from 'sinon';
import { expect } from 'chai';
import AWSXray from 'aws-xray-sdk';
import { xrayWrapper, RUNTIMES } from '../src/index.js';

const mockFn = sinon.spy();
let mockContext;

describe('xrayWrapper tests', () => {
  beforeEach(() => {
    sinon.resetHistory();
    mockContext = {
      runtime: { name: RUNTIMES.AWS_LAMBDA },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should call the original function with the provided req and context', async () => {
    const wrappedFn = xrayWrapper(mockFn);
    const req = { some: 'request' };

    await wrappedFn(req, mockContext);

    expect(mockFn.calledWith(req, mockContext)).to.be.true;
  });

  it('should add xray.instrument function to context if not already present', async () => {
    const wrappedFn = xrayWrapper(mockFn);
    const req = { some: 'request' };

    await wrappedFn(req, mockContext);

    expect(mockContext).to.have.property('xray');
    expect(mockContext.xray).to.be.an('object');
    expect(mockContext.xray.instrument).to.be.a('function');
  });

  it('should not overwrite existing context.xray', async () => {
    mockContext.xray = 42;
    const wrappedFn = xrayWrapper(mockFn);
    const req = { some: 'request' };

    await wrappedFn(req, mockContext);

    expect(mockContext.xray).to.equal(42);
  });

  it('should use AWSXray.captureAWSv3Client when runtime is AWS_LAMBDA', async () => {
    const captureStub = sinon.stub(AWSXray, 'captureAWSv3Client').returns('capturedClient');
    const wrappedFn = xrayWrapper(mockFn);
    const req = { some: 'request' };

    await wrappedFn(req, mockContext);

    const client = { dummy: 'client' };
    const instrumentedClient = mockContext.xray.instrument(client);

    expect(captureStub.calledWith(client)).to.be.true;
    expect(instrumentedClient).to.equal('capturedClient');
  });

  it('should return the original client if runtime is not AWS_LAMBDA', async () => {
    mockContext.runtime.name = 'some-other-runtime';
    const captureStub = sinon.stub(AWSXray, 'captureAWSv3Client');
    const wrappedFn = xrayWrapper(mockFn);
    const req = { some: 'request' };

    await wrappedFn(req, mockContext);

    const client = { dummy: 'client' };
    const instrumentedClient = mockContext.xray.instrument(client);

    expect(captureStub.called).to.be.false;
    expect(instrumentedClient).to.equal(client);
  });
});
