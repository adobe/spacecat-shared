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
import { expect } from 'chai';
import sinon from 'sinon';

import { enrichPathInfo } from '../src/enrich-path-info-wrapper.js';

describe('enrichPathInfo', () => {
  let mockRequest;
  let mockContext;
  let mockFn;

  beforeEach(() => {
    mockFn = sinon.stub().resolves({ status: 200 });

    mockRequest = {
      method: 'POST',
      headers: {
        plain: () => ({
          'content-type': 'application/json',
          'user-agent': 'test-agent',
        }),
      },
    };

    mockContext = {
      pathInfo: {
        suffix: '/api/test',
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should enrich context with pathInfo including method, headers, and route', async () => {
    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.pathInfo).to.deep.include({
      method: 'POST',
      route: 'api',
    });
    expect(mockContext.pathInfo.headers).to.deep.equal({
      'content-type': 'application/json',
      'user-agent': 'test-agent',
    });
  });

  it('should extract traceId from x-trace-id header and store in context', async () => {
    mockRequest.headers.plain = () => ({
      'content-type': 'application/json',
      'x-trace-id': '1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e',
    });

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.traceId).to.equal('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
  });

  it('should not set traceId in context when x-trace-id header is missing', async () => {
    mockRequest.headers.plain = () => ({
      'content-type': 'application/json',
    });

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.traceId).to.be.undefined;
  });

  it('should handle case-sensitive x-trace-id header', async () => {
    mockRequest.headers.plain = () => ({
      'content-type': 'application/json',
      'X-Trace-Id': '1-different-case',
    });

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    // Header keys should be lowercase
    expect(mockContext.traceId).to.be.undefined;
  });

  it('should call the wrapped function with request and context', async () => {
    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockFn.calledOnce).to.be.true;
    expect(mockFn.firstCall.args[0]).to.equal(mockRequest);
    expect(mockFn.firstCall.args[1]).to.equal(mockContext);
  });

  it('should return the result from the wrapped function', async () => {
    mockFn.resolves({ status: 201, body: 'created' });

    const wrapper = enrichPathInfo(mockFn);
    const result = await wrapper(mockRequest, mockContext);

    expect(result).to.deep.equal({ status: 201, body: 'created' });
  });

  it('should handle empty pathInfo suffix', async () => {
    mockContext.pathInfo.suffix = '';

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.pathInfo.route).to.be.undefined;
  });

  it('should handle missing pathInfo suffix', async () => {
    mockContext.pathInfo = {};

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.pathInfo.route).to.be.undefined;
  });

  it('should convert method to uppercase', async () => {
    mockRequest.method = 'get';

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.pathInfo.method).to.equal('GET');
  });

  it('should handle complex route extraction', async () => {
    mockContext.pathInfo.suffix = '/api/v1/users/123';

    const wrapper = enrichPathInfo(mockFn);
    await wrapper(mockRequest, mockContext);

    expect(mockContext.pathInfo.route).to.equal('api');
  });
});
