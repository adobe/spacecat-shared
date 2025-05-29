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
import { instrumentAWSClient } from '../src/index.js';

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
