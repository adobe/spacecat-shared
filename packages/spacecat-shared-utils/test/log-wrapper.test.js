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

import sinon from 'sinon';
import { expect } from 'chai';
import esmock from 'esmock';

let logWrapper;
let getTraceIdStub;

const message = {
  processingType: 'import',
  jobId: 'f91afda0-afc8-467e-bfa3-fdbeba3037e8',
  urls: [
    'https://www.example.com/path/to/resource/1',
    'https://www.example.com/path/to/resource/2',
    'https://www.example.com/path/to/resource/3',
  ],
};

const logLevels = [
  'info',
  'error',
  'debug',
  'warn',
  'trace',
  'verbose',
  'silly',
  'fatal',
];

const mockFnFromSqs = sinon.spy();
let mockContext;

describe('logWrapper tests', () => {
  before(async () => {
    getTraceIdStub = sinon.stub().returns(null);

    logWrapper = await esmock('../src/log-wrapper.js', {
      '../src/xray.js': {
        getTraceId: getTraceIdStub,
      },
    }).then((module) => module.logWrapper);
  });

  beforeEach(() => {
    sinon.resetHistory();
    getTraceIdStub.returns(null); // Default to no trace ID
    mockContext = {
      // Simulate an SQS event
      invocation: {
        event: {
          Records: [{
            body: message,
          }],
        },
      },
      log: {
        info: sinon.spy(),
        error: sinon.spy(),
        debug: sinon.spy(),
        warn: sinon.spy(),
        trace: sinon.spy(),
        verbose: sinon.spy(),
        silly: sinon.spy(),
        fatal: sinon.spy(),
      },
    };
  });

  afterEach(() => {
    sinon.resetHistory();
  });

  it('should call the original function with the provided message and context, and update the context with contextualLog object', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    // Verify the original function is called with the correct parameters
    expect(mockFnFromSqs.calledWith(message, mockContext)).to.be.true;

    // Verify the context is updated correctly
    expect(mockContext).to.have.property('contextualLog');
    expect(mockContext.contextualLog).to.be.an('object');
  });

  it('should handle empty messages and assign context.log to context.contextualLog', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    // Test with empty message
    await wrappedFn({}, mockContext);
    expect(mockFnFromSqs.calledWith({}, mockContext)).to.be.true;
    expect(mockContext).to.have.property('contextualLog');
    expect(mockContext.contextualLog).to.be.an('object');
    expect(mockContext.contextualLog).to.equal(mockContext.log);
  });

  it('should handle null messages and assign context.log to context.contextualLog', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    // Test with null message
    await wrappedFn(null, mockContext);
    expect(mockFnFromSqs.calledWith(null, mockContext)).to.be.true;
    expect(mockContext).to.have.property('contextualLog');
    expect(mockContext.contextualLog).to.be.an('object');
    expect(mockContext.contextualLog).to.equal(mockContext.log);
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with correct parameters when jobId is present`, async () => {
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper
      mockContext.contextualLog[level](`${level} log`);

      // Verify that the jobId is included in the log statement
      const logArgs = mockContext.log[level].getCall(0).args[0];
      expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
    });
  });

  logLevels.forEach((level) => {
    it(`should not include jobId in ${level} log when jobId is missing`, async () => {
      const wrappedFn = logWrapper(mockFnFromSqs);

      // Call without a jobId
      await wrappedFn({}, mockContext);

      // Log something to test the wrapper
      mockContext.contextualLog[level](`${level} log`);

      // Verify that the jobIdMarker is not included in the log statement
      const logArgs = mockContext.log[level].getCall(0).args[0];
      expect(logArgs).to.not.contain('[jobId=');
    });
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with traceId when available`, async () => {
      getTraceIdStub.returns('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper
      mockContext.contextualLog[level](`${level} log`);

      // Verify that the traceId is included in the log statement
      const logArgs = mockContext.log[level].getCall(0).args[0];
      expect(logArgs).to.contain('[traceId=1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e]');
    });
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with both jobId and traceId when both are available`, async () => {
      getTraceIdStub.returns('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper
      mockContext.contextualLog[level](`${level} log`);

      // Verify that both jobId and traceId are included in the log statement
      const logArgs = mockContext.log[level].getCall(0).args[0];
      expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
      expect(logArgs).to.contain('[traceId=1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e]');
    });
  });

  it('should not include traceId when getTraceId returns null', async () => {
    getTraceIdStub.returns(null);
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    // Log something to test the wrapper
    mockContext.contextualLog.info('info log');

    // Verify that the traceId is not included in the log statement
    const logArgs = mockContext.log.info.getCall(0).args[0];
    expect(logArgs).to.not.contain('[traceId=');
    expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
  });

  it('should assign context.log to context.contextualLog when neither jobId nor traceId are available', async () => {
    getTraceIdStub.returns(null);
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn({}, mockContext);

    expect(mockContext).to.have.property('contextualLog');
    expect(mockContext.contextualLog).to.equal(mockContext.log);
  });
});
