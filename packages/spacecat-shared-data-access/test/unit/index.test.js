/*
 * Copyright 2023 Adobe. All rights reserved.
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
import dataAccessWrapper from '../../src/index.js';

describe('Data Access Wrapper Tests', () => {
  let mockFn;
  let mockContext;
  let mockRequest;

  beforeEach(() => {
    mockFn = sinon.stub().resolves('function response');
    mockContext = {
      env: {
        POSTGREST_URL: 'http://localhost:3300',
      },
      log: {
        info: sinon.spy(),
        debug: sinon.spy(),
        error: sinon.spy(),
      },
    };
    mockRequest = {};
  });

  afterEach(() => {
    sinon.restore();
  });

  it('adds dataAccess to context and calls the wrapped function', async function () {
    this.timeout(10000);
    const wrappedFn = dataAccessWrapper(mockFn);

    const response = await wrappedFn(mockRequest, mockContext);

    expect(mockFn.calledOnceWithExactly(mockRequest, mockContext)).to.be.true;
    expect(response).to.equal('function response');
  });

  it('does not recreate dataAccess if already present in context', async function () {
    this.timeout(10000);
    mockContext.dataAccess = { existingDataAccess: true };
    const wrappedFn = dataAccessWrapper(mockFn);

    await wrappedFn(mockRequest, mockContext);

    expect(mockContext.dataAccess).to.deep.equal({ existingDataAccess: true });
  });

  it('throws when POSTGREST_URL is missing', async () => {
    delete mockContext.env.POSTGREST_URL;
    const wrappedFn = dataAccessWrapper(mockFn);

    try {
      await wrappedFn(mockRequest, mockContext);
      throw new Error('Expected wrapper to throw');
    } catch (error) {
      expect(error.message).to.equal('POSTGREST_URL is required');
    }
  });

  it('throws when S2S consumer is detected but s2sCtx is missing', async function () {
    this.timeout(10000);
    mockContext.attributes = {
      authInfo: { isS2SConsumer: () => true },
    };
    const wrappedFn = dataAccessWrapper(mockFn);

    try {
      await wrappedFn(mockRequest, mockContext);
      throw new Error('Expected wrapper to throw');
    } catch (error) {
      expect(error.message).to.equal(
        'S2S consumer detected but s2sCtx is missing — s2sAuthWrapper may not be configured',
      );
    }
  });

  it('proceeds when S2S consumer has a populated s2sCtx', async function () {
    this.timeout(10000);
    mockContext.attributes = {
      authInfo: { isS2SConsumer: () => true },
    };
    mockContext.s2sCtx = {
      clientId: 'test-client',
      capabilities: ['site:read'],
      scopedOrgId: 'org1',
    };
    const wrappedFn = dataAccessWrapper(mockFn);

    const response = await wrappedFn(mockRequest, mockContext);

    expect(response).to.equal('function response');
    expect(mockFn.calledOnce).to.be.true;
  });

  it('proceeds when authInfo is not an S2S consumer (end-user)', async function () {
    this.timeout(10000);
    mockContext.attributes = {
      authInfo: { isS2SConsumer: () => false },
    };
    const wrappedFn = dataAccessWrapper(mockFn);

    const response = await wrappedFn(mockRequest, mockContext);

    expect(response).to.equal('function response');
    expect(mockFn.calledOnce).to.be.true;
  });

  it('proceeds when authInfo is absent', async function () {
    this.timeout(10000);
    const wrappedFn = dataAccessWrapper(mockFn);

    const response = await wrappedFn(mockRequest, mockContext);

    expect(response).to.equal('function response');
    expect(mockFn.calledOnce).to.be.true;
  });
});
