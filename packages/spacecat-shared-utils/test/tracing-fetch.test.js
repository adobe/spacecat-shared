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
import { AbortController } from '@adobe/fetch';
import sinon from 'sinon';
import nock from 'nock';
import AWSXRay from 'aws-xray-sdk';
import { tracingFetch } from '../src/index.js';

describe('tracing fetch function', () => {
  let sandbox;
  let getSegmentStub;
  let parentSegment;
  let subsegment;
  let log;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    getSegmentStub = sandbox.stub(AWSXRay, 'getSegment');

    subsegment = {
      addAnnotation: sandbox.spy(),
      addMetadata: sandbox.spy(),
      addError: sandbox.spy(),
      close: sandbox.spy(),
    };

    parentSegment = {
      addNewSubsegment: sandbox.stub().returns(subsegment),
    };

    log = {
      warn: sandbox.spy(),
    };
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('calls adobeFetch and return response when there is no parent segment', async () => {
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

  it('creates subsegment, add annotations, call adobeFetch, and close subsegment', async () => {
    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';

    nock('https://example.com')
      .get('/api/data')
      .reply(200, 'OK');

    const options = { method: 'GET' };

    const response = await tracingFetch(url, options);

    expect(parentSegment.addNewSubsegment.calledOnceWithExactly(`HTTP GET ${url}`)).to.be.true;
    expect(subsegment.addAnnotation.calledWith('url', url)).to.be.true;
    expect(subsegment.addAnnotation.calledWith('method', 'GET')).to.be.true;

    expect(response.status).to.equal(200);
    const responseBody = await response.text();
    expect(responseBody).to.equal('OK');

    expect(subsegment.addMetadata.calledWith('statusCode', response.status)).to.be.true;

    expect(subsegment.close.calledOnce).to.be.true;
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

      expect(parentSegment.addNewSubsegment.calledOnceWithExactly(`HTTP GET ${url}`)).to.be.true;
      expect(subsegment.addAnnotation.calledWith('url', url)).to.be.true;

      expect(subsegment.addError.calledOnce).to.be.true;
      expect(subsegment.addError.getCall(0).args[0].message).to.equal('Network Error');

      expect(subsegment.close.calledOnce).to.be.true;
    }
  });

  it('handles timeout and returns 408 status with tracing', async () => {
    const fetchWithTimeout = async (url, timeout, logger) => {
      const controller = new AbortController();
      const { signal } = controller;
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await tracingFetch(url, { signal });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
          logger.warn(`Request to ${url} timed out after ${timeout}ms`);
          return { ok: false, status: 408 };
        } else {
          throw error;
        }
      }
    };

    getSegmentStub.returns(parentSegment);

    const url = 'https://example.com/api/data';
    nock('https://example.com')
      .get('/api/data')
      .delay(1000) // Delay longer than timeout
      .reply(200, 'OK');

    const timeout = 500; // Timeout shorter than response delay

    const response = await fetchWithTimeout(url, timeout, log);

    expect(response.ok).to.be.false;
    expect(response.status).to.equal(408);

    expect(parentSegment.addNewSubsegment.calledOnceWithExactly(`HTTP GET ${url}`)).to.be.true;
    expect(subsegment.addAnnotation.calledWith('url', url)).to.be.true;
    expect(subsegment.addError.calledOnce).to.be.true;
    expect(subsegment.close.calledOnce).to.be.true;

    expect(log.warn.calledOnceWithExactly(`Request to ${url} timed out after ${timeout}ms`)).to.be.true;
  });
});
