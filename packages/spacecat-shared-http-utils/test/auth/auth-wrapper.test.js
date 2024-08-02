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

import { Request } from '@adobe/fetch';
import wrap from '@adobe/helix-shared-wrap';
import chai from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { authWrapper, enrichPathInfo } from '../../src/index.js';
import AbstractHandler from '../../src/auth/handlers/abstract.js';
import { hasScopes } from '../../src/auth/scopes.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('auth wrapper', () => {
  const DummyHandler = class extends AbstractHandler {
    constructor(log) {
      super('dummy', log);
    }

    // eslint-disable-next-line class-methods-use-this,no-unused-vars
    async checkAuth(request, context) {
      return context.pathInfo.headers['x-api-key'] === 'test' ? { type: 'dummy' } : null;
    }
  };

  const action = wrap(() => 42)
    .with(authWrapper, { authHandlers: [DummyHandler] })
    .with(enrichPathInfo);

  let context;
  let mockDataAccess;
  let mockApiKeyRecord;

  beforeEach('setup', () => {
    mockDataAccess = {
      getApiKeyByHashedKey: sinon.stub(),
    };

    context = {
      attributes: {},
      log: console,
      pathInfo: {
        suffix: '',
      },
      dataAccess: mockDataAccess,
    };

    mockApiKeyRecord = {
      getId: () => 'test',
      getExpiresAt: () => '2099-12-31T23:59:59.999Z',
      getRevokedAt: () => '2099-12-31T23:59:59.999Z',
      getName: () => 'test-api-key',
      getScopes: () => ['scope1', 'scope2'],
    };
    mockDataAccess.getApiKeyByHashedKey.resolves(mockApiKeyRecord);
  });

  it('throws error if no auth handler is provided', async () => {
    const fn = wrap(() => 42)
      .with(authWrapper)
      .with(enrichPathInfo);

    const resp = await fn(new Request('https://space.cat/slack/events'), context);

    expect(await resp.text()).to.equal('Server error');
    expect(resp.status).to.equal(500);
  });

  it('passes anonymous route', async () => {
    context.pathInfo.suffix = '/slack/events';

    const resp = await action(new Request('https://space.cat/slack/events'), context);

    expect(resp).to.equal(42);
    expect(context.attributes.authInfo).to.be.undefined;
  });

  it('passes options method', async () => {
    context.pathInfo.method = 'OPTIONS';
    context.pathInfo.suffix = '/sites';

    const resp = await action(new Request('https://space.cat/sites', { method: 'OPTIONS' }), context);

    expect(resp).to.deep.equal(42);
    expect(context.attributes.authInfo).to.be.undefined;
  });

  it('successful authentication key invokes the user scoped handler', async () => {
    expect(context.attributes.authInfo).to.be.undefined;

    const resp = await action(new Request('https://space.cat/', {
      headers: { 'x-api-key': 'test' },
    }), context);

    expect(resp).to.equal(42);
    expect(context.attributes.authInfo).to.deep.equal({ type: 'dummy' });
  });

  it('unsuccessful authentication results in unauthorized', async () => {
    const resp = await action(new Request('https://space.cat/', {
      headers: { 'x-api-key': 'wrong-key' },
    }), context);

    expect(await resp.text()).to.equal('Unauthorized');
    expect(resp.status).to.equal(401);
  });

  it('fetches the scope from the data layer and returns true', async () => {
    const val = await hasScopes(['scope1', 'scope2'], 'test', context.dataAccess, context.log);
    expect(val).to.equal(true);
  });

  it('hasScopes returns false when API key is not found in the DB', async () => {
    mockDataAccess.getApiKeyByHashedKey.resolves({});
    const val = await hasScopes(['scope1', 'scope2'], 'test', context.dataAccess, context.log);
    expect(val).to.deep.equal({ result: false, reason: 'API key not found' });
  });

  it('hasScopes throws an error if there is no dataAccess object', async () => {
    await expect(hasScopes(['scope1', 'scope2'], 'test', null, context.log)).to.be.rejectedWith('Data access required');
  });

  it('hasScopes returns false when the api key is expired', async () => {
    mockApiKeyRecord.getExpiresAt = () => '2009-12-31T23:59:59.999Z';
    const val = await hasScopes(['scope1', 'scope2'], 'test', context.dataAccess, context.log);
    expect(val).to.deep.equal({ result: false, reason: 'API key has expired' });
  });

  it('hasScopes returns false when the api key is revoked', async () => {
    mockApiKeyRecord.getRevokedAt = () => '2009-12-31T23:59:59.999Z';
    const val = await hasScopes(['scope1', 'scope2'], 'test', context.dataAccess, context.log);
    expect(val).to.deep.equal({ result: false, reason: 'API key has been revoked' });
  });

  it('hasScopes returns false when a scope is missing', async () => {
    const val = await hasScopes(['scope3', 'scope2'], 'test', context.dataAccess, context.log);
    expect(val).to.deep.equal({ result: false, reason: 'API key is missing the [scope3] scope(s) required for this resource' });
  });
});
