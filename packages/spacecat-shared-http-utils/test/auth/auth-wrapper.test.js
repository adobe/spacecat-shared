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

import { Request } from '@adobe/fetch';
import wrap from '@adobe/helix-shared-wrap';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { authWrapper, enrichPathInfo } from '../../src/index.js';
import AbstractHandler from '../../src/auth/handlers/abstract.js';
import ScopedApiKeyHandler from '../../src/auth/handlers/scoped-api-key.js';

use(chaiAsPromised);

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
  let mockApiKey;

  beforeEach('setup', () => {
    context = {
      attributes: {},
      log: console,
      pathInfo: {
        suffix: '',
      },
      dataAccess: { ApiKey: { findByHashedApiKey: async () => mockApiKey } },
    };
    mockApiKey = {
      getId: () => 'test-id',
      getExpiresAt: () => null,
      getRevokedAt: () => null,
      getHashedApiKey: () => '372c6ba5a67b01a8d6c45e5ade6b41db9586ca06c77f0ef7795dfe895111fd0b',
      getName: () => 'Test API key name',
      getScopes: () => [
        {
          name: 'imports.write',
          domains: ['https://www.example.com'],
        },
      ],
    };
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
    // Slack only ever POSTs; GET /slack/events is no longer anonymous (VULN-39365).
    context.pathInfo.suffix = '/slack/events';

    const resp = await action(new Request('https://space.cat/slack/events', { method: 'POST' }), context);

    expect(resp).to.equal(42);
    expect(context.attributes.authInfo).to.be.undefined;
  });

  it('does NOT treat GET /slack/events as anonymous (VULN-39365)', async () => {
    // A GET carries no body to sign, so it could never be Slack-signature-verified. It must
    // fall through to the authentication manager, which rejects it.
    context.pathInfo.suffix = '/slack/events';

    const resp = await action(new Request('https://space.cat/slack/events'), context);

    expect(resp.status).to.equal(401);
    expect(context.attributes.authInfo).to.be.undefined;
  });

  it('honours an anonymousEndpoints override that disables the bypass', async () => {
    const locked = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: [] })
      .with(enrichPathInfo);
    context.pathInfo.suffix = '/slack/events';

    const resp = await locked(new Request('https://space.cat/slack/events', { method: 'POST' }), context);

    expect(resp.status).to.equal(401);
  });

  // The option governs ONLY the route-based list. These pin the two unconditional bypasses it
  // does not reach, so the documented contract cannot silently drift from the behaviour.
  it('anonymousEndpoints: [] does NOT authenticate OPTIONS requests', async () => {
    const locked = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: [] })
      .with(enrichPathInfo);
    context.pathInfo.suffix = '/sites';

    const resp = await locked(new Request('https://space.cat/sites', { method: 'OPTIONS' }), context);

    expect(resp).to.equal(42);
  });

  it('anonymousEndpoints: [] does NOT authenticate POST /hooks/site-detection/*', async () => {
    const locked = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: [] })
      .with(enrichPathInfo);
    context.pathInfo.suffix = '/hooks/site-detection/cdn/some-secret';

    const resp = await locked(
      new Request('https://space.cat/hooks/site-detection/cdn/some-secret', { method: 'POST' }),
      context,
    );

    expect(resp).to.equal(42);
  });

  it('a non-empty override drops the default POST /slack/events', async () => {
    const custom = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: ['POST /custom/hook'] })
      .with(enrichPathInfo);
    context.pathInfo.suffix = '/slack/events';

    const resp = await custom(new Request('https://space.cat/slack/events', { method: 'POST' }), context);

    expect(resp.status).to.equal(401);
  });

  it('copies anonymousEndpoints so later mutation cannot widen the bypass', async () => {
    const caller = [];
    const locked = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: caller })
      .with(enrichPathInfo);
    caller.push('POST /slack/events');
    context.pathInfo.suffix = '/slack/events';

    const resp = await locked(new Request('https://space.cat/slack/events', { method: 'POST' }), context);

    expect(resp.status).to.equal(401);
  });

  it('honours an anonymousEndpoints override that names a different route', async () => {
    const custom = wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: ['POST /custom/hook'] })
      .with(enrichPathInfo);
    context.pathInfo.suffix = '/custom/hook';

    const resp = await custom(new Request('https://space.cat/custom/hook', { method: 'POST' }), context);

    expect(resp).to.equal(42);
  });

  it('throws on a non-array anonymousEndpoints instead of silently using the default', () => {
    // Security-sensitive config: a typo by a service trying to DISABLE the bypass must not
    // silently re-enable an unauthenticated POST /slack/events.
    expect(() => wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: 'POST /slack/events' })
      .with(enrichPathInfo)).to.throw('anonymousEndpoints must be an array');
  });

  it('throws on an anonymousEndpoints array containing a non-string', () => {
    expect(() => wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: ['POST /slack/events', 42] })
      .with(enrichPathInfo)).to.throw('anonymousEndpoints must be an array');
  });

  it('throws on a lower-case method, which would validate but never match', () => {
    expect(() => wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: ['post /slack/events'] })
      .with(enrichPathInfo)).to.throw('upper-case method');
  });

  it('throws on an entry with no leading slash on the path', () => {
    expect(() => wrap(() => 42)
      .with(authWrapper, { authHandlers: [DummyHandler], anonymousEndpoints: ['POST slack/events'] })
      .with(enrichPathInfo)).to.throw('upper-case method');
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

  it('should add auth.checkScopes to the context', async () => {
    const scopedAction = wrap(() => 42)
      .with(authWrapper, { authHandlers: [ScopedApiKeyHandler] })
      .with(enrichPathInfo);

    const resp = await scopedAction(new Request('https://space.cat/', {
      headers: { 'x-api-key': 'test-api-key' },
    }), context);

    expect(resp).to.equal(42);
    expect(context.auth.checkScopes).to.be.a('function');

    // Throws an error if checkScopes check fails
    context.auth.checkScopes(['imports.write']);

    const expectedError = 'API key is missing the [scope-user-does-not-have] scope(s) required for this resource';
    expect(() => context.auth.checkScopes(['scope-user-does-not-have'])).to.throw(expectedError);
  });
});
