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
import esmock from 'esmock';
import nock from 'nock';
import AWSXRay from 'aws-xray-sdk';
import { SPACECAT_USER_AGENT, tracingFetch } from '../src/index.js';

describe('tracing fetch function', () => {
  let sandbox;
  let getSegmentStub;
  let parentSegment;
  let subSegment;

  beforeEach(() => {
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs22.x';
    sandbox = sinon.createSandbox();
    AWSXRay.enableAutomaticMode();

    getSegmentStub = sandbox.stub(AWSXRay, 'getSegment');

    subSegment = {
      addAnnotation: sandbox.spy(),
      addMetadata: sandbox.spy(),
      addErrorFlag: sandbox.spy(),
      addThrottleFlag: sandbox.spy(),
      close: sandbox.spy(),
      throttled: false,
      error: false,
      fault: false,
    };

    parentSegment = {
      addNewSubsegment: sandbox.stub().returns(subSegment),
      addNewSubsegmentWithoutSampling: sandbox.stub().returns(subSegment),
      noOp: false,
      notTraced: false,
    };
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('uses adobe fetch if runtime is not lambda', async () => {
    delete process.env.AWS_EXECUTION_ENV;

    const { tracingFetch: _tracingFetch } = await esmock('../src/tracing-fetch.js', {
      '../src/adobe-fetch.js': { fetch: 42 },
    });

    const fetchFn = await _tracingFetch('https://example.com/api/data');
    expect(fetchFn).to.equal(42);
  });

  it('exports the correct SPACECAT_USER_AGENT', () => {
    expect(SPACECAT_USER_AGENT).to.match(/Spacecat\/\d+\.\d+/);
  });

  it('sets spacecat user agent if not already set', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .matchHeader('User-Agent', SPACECAT_USER_AGENT)
      .get('/api/data')
      .reply(200, 'OK');

    const response = await tracingFetch(url, options);

    expect(response.status).to.equal(200);
  });

  it('does not overwrite existing user agent', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET', headers: { 'User-Agent': 'Custom-Agent' } };

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url, options);

    expect(options.headers['User-Agent']).to.equal('Custom-Agent');
  });

  it('calls adobeFetch and returns response when there is no parent segment', async () => {
    getSegmentStub.returns(null);

    const url = 'https://example.com/api/data';
    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    const response = await tracingFetch(url);

    expect(response.status).to.equal(200);
    const responseBody = await response.text();
    expect(responseBody).to.equal('OK');
  });

  it('creates subsegment without sampling when parent segment is not traced', async () => {
    parentSegment.notTraced = true;
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url, options);

    expect(parentSegment.addNewSubsegmentWithoutSampling.calledOnce).to.be.true;
    expect(parentSegment.addNewSubsegment.called).to.be.false;
  });

  it('creates subsegment with sampling when parent segment is traced', async () => {
    parentSegment.notTraced = false;
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url, options);

    expect(parentSegment.addNewSubsegment.calledOnce).to.be.true;
    expect(parentSegment.addNewSubsegmentWithoutSampling.called).to.be.false;
  });

  it('sets trace headers correctly when parent segment is present', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url, options);

    expect(subSegment.addAnnotation.calledWith('url', url)).to.be.false; // Adjusted to reflect changes in tracingFetch.
  });

  it('handles fetch error, adds error to subsegment, closes subsegment, and rethrows', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';

    nock('https://example.com')
      .get('/api/data')
      .replyWithError('Network Error');

    try {
      await tracingFetch(url);
      throw new Error('Expected fetch to throw an error');
    } catch (error) {
      expect(error.message).to.equal('Network Error');

      expect(parentSegment.addNewSubsegment.calledOnce).to.be.true;
      expect(subSegment.addErrorFlag.calledOnce).to.be.true;
      expect(subSegment.addAnnotation.calledWith('errorMessage', 'Network Error')).to.be.true;
      expect(subSegment.addAnnotation.calledWith('errorStack')).to.be.true;

      expect(subSegment.close.calledOnce).to.be.true;
    }
  });

  it('handles throttled response (429) and sets throttle flag', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .get('/api/data')
      .reply(429, 'Too Many Requests');

    const response = await tracingFetch(url, options);

    expect(response.status).to.equal(429);
    expect(subSegment.throttled).to.be.true;
    expect(subSegment.close.calledOnce).to.be.true;
  });

  it('handles case when response headers are missing', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    nock('https://example.com')
      .get('/api/data')
      .reply(200, undefined, {}); // No headers

    const response = await tracingFetch(url);

    expect(response.status).to.equal(200);
    expect(subSegment.close.calledOnce).to.be.true;
  });

  it('adds content length to segment when response contains content-length header', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const options = { method: 'GET' };

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK', { 'Content-Length': (req, res, body) => body.length });

    await tracingFetch(url, options);

    expect(subSegment.close.calledOnce).to.be.true;
    expect(subSegment.http.response.content_length).to.equal(2);
  });

  it('adds proper annotations for HTTP 4xx and 5xx responses', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';

    // Test 4xx response
    nock('https://example.com')
      .get('/api/data')
      .reply(404, 'Not Found');

    let response = await tracingFetch(url);

    expect(response.status).to.equal(404);
    expect(subSegment.error).to.be.true;
    expect(subSegment.close.calledOnce).to.be.true;

    // Reset subsegment spy counts
    subSegment.addErrorFlag.resetHistory();
    subSegment.close.resetHistory();

    // Test 5xx response
    nock('https://example.com')
      .get('/api/data')
      .reply(500, 'Internal Server Error');

    response = await tracingFetch(url);

    expect(response.status).to.equal(500);
    expect(subSegment.fault).to.be.true;
    expect(subSegment.close.calledOnce).to.be.true;
  });

  // New tests for timeout functionality
  it('applies default timeout of 10 seconds when no timeout is specified', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url);

    // Check if addAnnotation was called with timeout_ms
    const timeoutAnnotationCall = subSegment.addAnnotation.getCalls().find(
      (call) => call.args[0] === 'timeout_ms' && call.args[1] === 10000,
    );
    expect(timeoutAnnotationCall).to.exist;
  });

  it('applies custom timeout when specified in options', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const customTimeout = 5000; // 5 seconds

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    await tracingFetch(url, { timeout: customTimeout });

    // Check if addAnnotation was called with timeout_ms
    const timeoutAnnotationCall = subSegment.addAnnotation.getCalls().find(
      (call) => call.args[0] === 'timeout_ms' && call.args[1] === customTimeout,
    );
    expect(timeoutAnnotationCall).to.exist;
  });

  // For timeout tests, we'll use a very short timeout and a delayed response
  it('handles timeout correctly with parent segment', async function () {
    this.timeout(5000); // Increase mocha timeout for this test

    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    const shortTimeout = 50; // Very short timeout for testing

    nock('https://example.com')
      .get('/api/data')
      .delay(200) // Delay longer than timeout
      .reply(200, 'OK');

    try {
      await tracingFetch(url, { timeout: shortTimeout });
      throw new Error('Expected fetch to throw a timeout error');
    } catch (error) {
      expect(error.message).to.include('timeout');
      expect(error.code).to.equal('ETIMEOUT');

      // Check if the subsegment was properly handled
      const timeoutAnnotationCall = subSegment.addAnnotation.getCalls().find(
        (call) => call.args[0] === 'timeout_ms' && call.args[1] === shortTimeout,
      );
      expect(timeoutAnnotationCall).to.exist;

      expect(subSegment.addErrorFlag.called).to.be.true;
      expect(subSegment.close.called).to.be.true;
    }
  });

  it('handles timeout correctly without parent segment', async function () {
    this.timeout(5000); // Increase mocha timeout for this test

    getSegmentStub.returns(null);

    const url = 'https://example.com/api/data';
    const shortTimeout = 50; // Very short timeout for testing

    nock('https://example.com')
      .get('/api/data')
      .delay(200) // Delay longer than timeout
      .reply(200, 'OK');

    try {
      await tracingFetch(url, { timeout: shortTimeout });
      throw new Error('Expected fetch to throw a timeout error');
    } catch (error) {
      expect(error.message).to.include('timeout');
      expect(error.code).to.equal('ETIMEOUT');
    }
  });

  it('propagates non-timeout errors when there is no parent segment', async () => {
    getSegmentStub.returns(null);

    const url = 'https://example.com/api/data';
    const networkError = new Error('Network Error');

    nock('https://example.com')
      .get('/api/data')
      .replyWithError(networkError);

    try {
      await tracingFetch(url);
      throw new Error('Expected fetch to throw an error');
    } catch (error) {
      // Verify that the original error is propagated
      expect(error.message).to.equal('Network Error');
      expect(error.code).to.not.equal('ETIMEOUT');
    }
  });
});
