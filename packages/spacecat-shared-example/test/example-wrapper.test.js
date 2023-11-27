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
import assert from 'assert';

// eslint-disable-next-line import/no-named-default
import { default as example } from '../src/example-wrapper.js';

describe('example function', () => {
  it('should call the passed function and log the correct message', async () => {
    // Setup for capturing console.log output
    const originalConsoleLog = console.log;
    let loggedMessage = '';
    console.log = (message) => {
      loggedMessage = message;
    };

    // Mock function and test data
    let wasCalled = false;
    let receivedRequest;
    let receivedContext;
    const mockFunc = (request, context) => {
      wasCalled = true;
      receivedRequest = request;
      receivedContext = context;
    };
    const request = { key: 'value' };
    const context = { contextKey: 'contextValue' };
    const opts = { name: 'TestName' };

    // Call the function
    const wrappedFunc = example(mockFunc, opts);
    await wrappedFunc(request, context);

    // Restore console.log
    console.log = originalConsoleLog;

    // Assertions
    assert(wasCalled, 'Function was not called');
    assert.deepStrictEqual(receivedRequest, request, 'Request object does not match');
    assert.deepStrictEqual(receivedContext, context, 'Context object does not match');
    assert.strictEqual(loggedMessage, `Hello world, ${opts.name} [36]!`, 'Logged message does not match expected output');
  });
});
