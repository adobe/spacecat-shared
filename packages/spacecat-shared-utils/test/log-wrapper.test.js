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

  it('should call the original function with the provided message and context', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    // Verify the original function is called with the correct parameters
    expect(mockFnFromSqs.calledWith(message, mockContext)).to.be.true;
  });

  it('should handle empty messages without errors', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    // Test with empty message
    await wrappedFn({}, mockContext);
    expect(mockFnFromSqs.calledWith({}, mockContext)).to.be.true;
  });

  it('should handle null messages without errors', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    // Test with null message
    await wrappedFn(null, mockContext);
    expect(mockFnFromSqs.calledWith(null, mockContext)).to.be.true;
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with correct parameters when jobId is present`, async () => {
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper using context.log
      mockContext.log[level](`${level} log`);

      // Verify that the jobId is included in the log statement
      const logArgs = originalLog[level].getCall(0).args[0];
      expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
    });
  });

  logLevels.forEach((level) => {
    it(`should not include jobId in ${level} log when jobId is missing`, async () => {
      const wrappedFn = logWrapper(mockFnFromSqs);

      // Call without a jobId
      await wrappedFn({}, mockContext);

      // Log something to test the wrapper using context.log
      mockContext.log[level](`${level} log`);

      // Verify that the jobIdMarker is not included in the log statement
      const logArgs = mockContext.log[level].getCall(0).args[0];
      expect(logArgs).to.equal(`${level} log`);
    });
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with traceId when available`, async () => {
      getTraceIdStub.returns('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper using context.log
      mockContext.log[level](`${level} log`);

      // Verify that the traceId is included in the log statement
      const logArgs = originalLog[level].getCall(0).args[0];
      expect(logArgs).to.contain('[traceId=1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e]');
    });
  });

  logLevels.forEach((level) => {
    it(`should call ${level} log method with both jobId and traceId when both are available`, async () => {
      getTraceIdStub.returns('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log something to test the wrapper using context.log
      mockContext.log[level](`${level} log`);

      // Verify that both jobId and traceId are included in the log statement
      const logArgs = originalLog[level].getCall(0).args[0];
      expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
      expect(logArgs).to.contain('[traceId=1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e]');
    });
  });

  it('should not include traceId when getTraceId returns null', async () => {
    getTraceIdStub.returns(null);
    const originalLog = mockContext.log;
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    // Log something to test the wrapper using context.log
    mockContext.log.info('info log');

    // Verify that the traceId is not included in the log statement
    const logArgs = originalLog.info.getCall(0).args[0];
    expect(logArgs).to.not.contain('[traceId=');
    expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
  });

  it('should not modify context.log when neither jobId nor traceId are available', async () => {
    getTraceIdStub.returns(null);
    const originalLog = mockContext.log;
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn({}, mockContext);

    // context.log should remain unchanged
    expect(mockContext.log).to.equal(originalLog);
  });

  // Tests to verify context.log is enhanced directly (main feature)
  logLevels.forEach((level) => {
    it(`should enhance context.log.${level} directly with jobId and traceId`, async () => {
      getTraceIdStub.returns('1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e');
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Verify that context.log is a new enhanced object, not the original
      expect(mockContext.log).to.not.equal(originalLog);

      // Log something using context.log (not contextualLog)
      mockContext.log[level](`${level} log`);

      // Verify that the original log method was called with markers
      const logArgs = originalLog[level].getCall(0).args[0];
      expect(logArgs).to.contain(`[jobId=${message.jobId}]`);
      expect(logArgs).to.contain('[traceId=1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e]');
    });
  });

  it('should keep context.log unchanged when no jobId or traceId is available', async () => {
    getTraceIdStub.returns(null);
    const originalLog = mockContext.log;
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn({}, mockContext);

    // context.log should remain unchanged
    expect(mockContext.log).to.equal(originalLog);
  });

  // Test format string interpolation
  logLevels.forEach((level) => {
    it(`should properly handle format strings with placeholders in ${level} log`, async () => {
      getTraceIdStub.returns('1-abc-def');
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log with format string placeholders
      mockContext.log[level]('Found %d items for site %s', 42, 'example.com');

      // Verify that the enhanced log was called with the correct format string and args
      expect(originalLog[level].calledOnce).to.be.true;
      const callArgs = originalLog[level].getCall(0).args;

      // First arg should be the format string with markers prepended
      expect(callArgs[0]).to.include('[jobId=');
      expect(callArgs[0]).to.include('[traceId=1-abc-def]');
      expect(callArgs[0]).to.include('Found %d items for site %s');

      // Subsequent args should be the format string arguments
      expect(callArgs[1]).to.equal(42);
      expect(callArgs[2]).to.equal('example.com');
    });
  });

  // Test non-string first argument (covers else branch)
  logLevels.forEach((level) => {
    it(`should pass through non-string arguments in ${level} log`, async () => {
      getTraceIdStub.returns('1-abc-def');
      const originalLog = mockContext.log;
      const wrappedFn = logWrapper(mockFnFromSqs);

      await wrappedFn(message, mockContext);

      // Log with non-string first argument (e.g., object or number)
      const errorObject = new Error('Test error');
      mockContext.log[level](errorObject);

      // Verify that the original log was called with the error object as-is
      expect(originalLog[level].calledOnce).to.be.true;
      const callArgs = originalLog[level].getCall(0).args;
      expect(callArgs[0]).to.equal(errorObject);
    });
  });
});
