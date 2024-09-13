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
import { logWrapper } from '../src/index.js';

const message = {
  processingType: 'import',
  jobId: 'f91afda0-afc8-467e-bfa3-fdbeba3037e8',
  urls: [
    'https://www.example.com/path/to/resource/1',
    'https://www.example.com/path/to/resource/2',
    'https://www.example.com/path/to/resource/3',
  ],
};

// Helper function to check if a key-value pair exists in a JSON object
function containsKeyValue(obj, key, value) {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] === value;
}

const mockFnFromSqs = sinon.spy();
let mockContext;

describe('logWrapper', () => {
  beforeEach(() => {
    sinon.resetHistory();
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
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should wrap log methods to include jobId when jobId is present', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    mockContext.contextualLog.info('Test log');
    const logArgs = mockContext.log.info.getCall(0).args[0];
    expect(containsKeyValue(logArgs, 'jobId', message.jobId)).to.be.true;
  });

  it('should not wrap log methods when jobId is missing', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn({ message: 'This contains no jobId' }, mockContext);

    mockContext.contextualLog.info('Test log');
    const logArgs = mockContext.log.info.getCall(0).args[0];
    expect(containsKeyValue(logArgs, 'jobId', undefined)).to.be.false;
    expect(logArgs).to.equal('Test log');
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

  it('should call log methods with correct parameters when jobId is present', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn(message, mockContext);

    mockContext.contextualLog.info('Info log');
    mockContext.contextualLog.error('Error log');
    mockContext.contextualLog.debug('Debug log');
    mockContext.contextualLog.warn('Warn log');

    expect(containsKeyValue(mockContext.log.info.getCall(0).args[0], 'jobId', message.jobId)).to.be.true;
    expect(containsKeyValue(mockContext.log.error.getCall(0).args[0], 'jobId', message.jobId)).to.be.true;
    expect(containsKeyValue(mockContext.log.debug.getCall(0).args[0], 'jobId', message.jobId)).to.be.true;
    expect(containsKeyValue(mockContext.log.warn.getCall(0).args[0], 'jobId', message.jobId)).to.be.true;
  });

  it('should call log methods with correct parameters when jobId is missing', async () => {
    const wrappedFn = logWrapper(mockFnFromSqs);

    await wrappedFn({}, mockContext);

    mockContext.contextualLog.info('Info log');
    mockContext.contextualLog.error('Error log');
    mockContext.contextualLog.debug('Debug log');
    mockContext.contextualLog.warn('Warn log');

    expect(containsKeyValue(mockContext.log.info.getCall(0).args[0], 'jobId', undefined)).to.be.false;
    expect(containsKeyValue(mockContext.log.error.getCall(0).args[0], 'jobId', undefined)).to.be.false;
    expect(containsKeyValue(mockContext.log.debug.getCall(0).args[0], 'jobId', undefined)).to.be.false;
    expect(containsKeyValue(mockContext.log.warn.getCall(0).args[0], 'jobId', undefined)).to.be.false;
  });
});
