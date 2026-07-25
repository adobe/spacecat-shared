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

import { expect } from 'chai';
import { ProjectEngineApiError } from '../src/errors.js';

describe('ProjectEngineApiError', () => {
  it('is a subclass of Error with the expected name', () => {
    const err = new ProjectEngineApiError(404, 'GET', null);
    expect(err).to.be.instanceOf(Error);
    expect(err).to.be.instanceOf(ProjectEngineApiError);
    expect(err.name).to.equal('ProjectEngineApiError');
  });

  it('with a status: message includes method + status, and carries the fields', () => {
    const body = { detail: 'nope' };
    const err = new ProjectEngineApiError(409, 'POST', body);
    expect(err.message).to.equal('Project Engine POST request failed with status 409');
    expect(err.status).to.equal(409);
    expect(err.method).to.equal('POST');
    expect(err.body).to.deep.equal(body);
    expect(err.cause).to.equal(undefined);
  });

  it('without a status (network/timeout): message omits the status', () => {
    const err = new ProjectEngineApiError(undefined, 'DELETE', null);
    expect(err.message).to.equal('Project Engine DELETE request failed');
    expect(err.status).to.equal(undefined);
    expect(err.method).to.equal('DELETE');
    expect(err.body).to.equal(null);
  });

  it('forwards options.cause to the underlying Error', () => {
    const cause = new TypeError('socket hang up');
    const err = new ProjectEngineApiError(undefined, 'GET', null, { cause });
    expect(err.cause).to.equal(cause);
  });
});
