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
import AWSXray from 'aws-xray-sdk';
import { instrumentAWSClient, getTraceId, addTraceIdHeader } from '../src/index.js';

describe('instrumentClient', () => {
  let captureStub;

  beforeEach(() => {
    captureStub = sinon.stub(AWSXray, 'captureAWSv3Client');
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.AWS_EXECUTION_ENV;
  });

  it('should use AWSXray.captureAWSv3Client when AWS_EXECUTION_ENV indicates Lambda', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';

    const client = { dummy: 'client' };
    captureStub.returns('capturedClient');

    const result = instrumentAWSClient(client);

    expect(captureStub.calledOnceWithExactly(client)).to.be.true;
    expect(result).to.equal('capturedClient');
  });

  it('should return original client when AWS_EXECUTION_ENV is undefined', () => {
    delete process.env.AWS_EXECUTION_ENV;

    const client = { dummy: 'client' };

    const result = instrumentAWSClient(client);

    expect(captureStub.called).to.be.false;
    expect(result).to.equal(client);
  });
});

describe('getTraceId', () => {
  let getSegmentStub;

  beforeEach(() => {
    getSegmentStub = sinon.stub(AWSXray, 'getSegment');
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.AWS_EXECUTION_ENV;
  });

  it('should return null when not in AWS Lambda environment', () => {
    delete process.env.AWS_EXECUTION_ENV;

    const result = getTraceId();

    expect(result).to.be.null;
    expect(getSegmentStub.called).to.be.false;
  });

  it('should return null when segment is not available', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    getSegmentStub.returns(null);

    const result = getTraceId();

    expect(result).to.be.null;
    expect(getSegmentStub.calledOnce).to.be.true;
  });

  it('should return trace ID from segment', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockSegment = {
      trace_id: '1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e',
    };
    getSegmentStub.returns(mockSegment);

    const result = getTraceId();

    expect(result).to.equal('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
  });

  it('should return trace ID from root segment when segment has nested structure', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockRootSegment = {
      trace_id: '1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e',
    };
    const mockSegment = {
      segment: mockRootSegment,
    };
    getSegmentStub.returns(mockSegment);

    const result = getTraceId();

    expect(result).to.equal('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
  });

  it('should return null when segment exists but has no trace_id', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockSegment = {
      id: 'some-segment-id',
    };
    getSegmentStub.returns(mockSegment);

    const result = getTraceId();

    expect(result).to.be.undefined;
  });
});

describe('addTraceIdHeader', () => {
  let getSegmentStub;

  beforeEach(() => {
    getSegmentStub = sinon.stub(AWSXray, 'getSegment');
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.AWS_EXECUTION_ENV;
  });

  it('should add x-trace-id header when context.traceId is present', () => {
    const headers = { 'content-type': 'application/json' };
    const context = { traceId: '1-context-traceid' };

    const result = addTraceIdHeader(headers, context);

    expect(result).to.deep.equal({
      'content-type': 'application/json',
      'x-trace-id': '1-context-traceid',
    });
  });

  it('should add x-trace-id header from X-Ray when context.traceId is not present', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockSegment = {
      trace_id: '1-xray-traceid',
    };
    getSegmentStub.returns(mockSegment);

    const headers = { 'content-type': 'application/json' };
    const context = {};

    const result = addTraceIdHeader(headers, context);

    expect(result).to.deep.equal({
      'content-type': 'application/json',
      'x-trace-id': '1-xray-traceid',
    });
  });

  it('should prioritize context.traceId over X-Ray trace ID', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockSegment = {
      trace_id: '1-xray-traceid',
    };
    getSegmentStub.returns(mockSegment);

    const headers = { 'content-type': 'application/json' };
    const context = { traceId: '1-context-traceid' };

    const result = addTraceIdHeader(headers, context);

    expect(result).to.deep.equal({
      'content-type': 'application/json',
      'x-trace-id': '1-context-traceid',
    });
    expect(getSegmentStub.called).to.be.false;
  });

  it('should return original headers when no trace ID is available', () => {
    delete process.env.AWS_EXECUTION_ENV;

    const headers = { 'content-type': 'application/json' };
    const context = {};

    const result = addTraceIdHeader(headers, context);

    expect(result).to.deep.equal({
      'content-type': 'application/json',
    });
  });

  it('should work with empty headers object', () => {
    const headers = {};
    const context = { traceId: '1-test-traceid' };

    const result = addTraceIdHeader(headers, context);

    expect(result).to.deep.equal({
      'x-trace-id': '1-test-traceid',
    });
  });

  it('should work with no headers parameter', () => {
    const context = { traceId: '1-test-traceid' };

    const result = addTraceIdHeader(undefined, context);

    expect(result).to.deep.equal({
      'x-trace-id': '1-test-traceid',
    });
  });

  it('should work with no context parameter', () => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
    const mockSegment = {
      trace_id: '1-xray-traceid',
    };
    getSegmentStub.returns(mockSegment);

    const headers = { 'content-type': 'application/json' };

    const result = addTraceIdHeader(headers, undefined);

    expect(result).to.deep.equal({
      'content-type': 'application/json',
      'x-trace-id': '1-xray-traceid',
    });
  });
});
