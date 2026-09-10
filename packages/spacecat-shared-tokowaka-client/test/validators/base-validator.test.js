/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BaseValidator from '../../src/validators/base-validator.js';

use(sinonChai);

describe('BaseValidator', () => {
  let log;
  let validator;

  beforeEach(() => {
    log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
    validator = new BaseValidator(log);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('getType() throws and logs an error', () => {
    expect(() => validator.getType()).to.throw('getType() must be implemented by subclass');
    expect(log.error).to.have.been.calledOnce;
  });

  it('validate() throws and logs an error', async () => {
    let thrown;
    try {
      await validator.validate({}, {});
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(Error);
    expect(thrown.message).to.equal('validate() must be implemented by subclass');
    expect(log.error).to.have.been.calledOnce;
  });
});
