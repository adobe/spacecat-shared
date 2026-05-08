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
import sinon from 'sinon';

import { macGiverClientWrapper } from '../src/mac-giver-client-wrapper.js';
import MacGiverClient from '../src/mac-giver-client.js';

describe('macGiverClientWrapper', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  it('creates a MacGiverClient and attaches it to context', async () => {
    const context = {
      env: { MACGIVER_BASE_URL: 'http://macgiver.test' },
      imsClient: { getServiceToken: sandbox.stub() },
      log: console,
    };
    const fn = sandbox.stub().resolves('ok');

    await macGiverClientWrapper(fn)({}, context);

    expect(context.macGiverClient).to.be.instanceOf(MacGiverClient);
    expect(context.macGiverClient.macGiverBaseUrl).to.equal('http://macgiver.test');
    expect(fn.calledOnce).to.be.true;
  });

  it('does not overwrite an existing macGiverClient on context', async () => {
    const existing = { existing: true };
    const context = {
      env: {},
      imsClient: {},
      macGiverClient: existing,
      log: console,
    };
    const fn = sandbox.stub().resolves('ok');

    await macGiverClientWrapper(fn)({}, context);

    expect(context.macGiverClient).to.equal(existing);
  });

  it('passes request and context through to the wrapped function', async () => {
    const request = { method: 'GET' };
    const context = { env: {}, imsClient: {}, log: console };
    const fn = sandbox.stub().resolves('response');

    const result = await macGiverClientWrapper(fn)(request, context);

    expect(fn.calledWith(request, context)).to.be.true;
    expect(result).to.equal('response');
  });
});
