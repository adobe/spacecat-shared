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
import { createSerenityProjectEngineApiClient } from '../src/client.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const sandbox = sinon.createSandbox();
afterEach(() => sandbox.restore());

describe('createSerenityProjectEngineApiClient', () => {
  it('sends the IMS token as Authorization: Bearer, not Auth-Data-Jwt', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example',
      authToken: 'raw-ims-jwt',
      fetch,
    });

    await client.GET('/v1/countries');

    expect(fetch.callCount).to.equal(1);
    const request = fetch.firstCall.args[0];
    expect(request.headers.get('Authorization')).to.equal('Bearer raw-ims-jwt');
    expect(request.headers.get('Auth-Data-Jwt')).to.equal(null);
    // the client appends the fixed /enterprise/projects/api prefix to the supplied origin
    expect(request.url).to.equal('https://serenity.example/enterprise/projects/api/v1/countries');
  });

  it('resolves an async token getter per request (no token captured at construction)', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    let current = 'token-1';
    const client = createSerenityProjectEngineApiClient({
      // a base URL that already carries the prefix normalises to the same target (idempotent)
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: async () => current,
      fetch,
    });

    await client.GET('/v1/countries');
    current = 'token-2';
    await client.GET('/v1/countries');

    expect(fetch.firstCall.args[0].headers.get('Authorization')).to.equal('Bearer token-1');
    expect(fetch.secondCall.args[0].headers.get('Authorization')).to.equal('Bearer token-2');
    expect(fetch.firstCall.args[0].url)
      .to.equal('https://serenity.example/enterprise/projects/api/v1/countries');
  });

  it('normalises a base URL with a leftover path to its origin + the API prefix', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/some/leftover/path',
      authToken: 'raw-ims-jwt',
      fetch,
    });

    await client.GET('/v1/countries');

    expect(fetch.firstCall.args[0].url)
      .to.equal('https://serenity.example/enterprise/projects/api/v1/countries');
  });

  it('throws at construction when the base URL is not a valid URL', () => {
    expect(() => createSerenityProjectEngineApiClient({
      baseUrl: 'not a url',
      authToken: 'raw-ims-jwt',
    })).to.throw(/invalid baseUrl/);
  });

  it('throws at construction when the base URL is not http(s)', () => {
    expect(() => createSerenityProjectEngineApiClient({
      baseUrl: 'ftp://serenity.example',
      authToken: 'raw-ims-jwt',
    })).to.throw(/must be http/);
  });

  it('applies retry defaults: retries a retryable 5xx GET', async () => {
    const fetch = sandbox.stub();
    fetch.onCall(0).resolves(json({ err: true }, 503));
    fetch.onCall(1).resolves(json({ ok: true }, 200));

    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: 'raw-ims-jwt',
      retryBaseDelayMs: 0,
      fetch,
    });

    const { response } = await client.GET('/v1/countries');
    expect(response.status).to.equal(200);
    expect(fetch.callCount).to.equal(2);
  });

  it('fails fast (and never sends the request) when the token resolves to empty', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: () => '',
      fetch,
    });

    let thrown;
    try {
      await client.GET('/v1/countries');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.be.an('error');
    expect(thrown.message).to.contain('empty');
    expect(fetch.called).to.equal(false);
  });

  it('propagates an error thrown by the token getter (e.g. IMS outage) and never sends the request', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const imsOutage = new Error('IMS token endpoint unavailable');
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: async () => { throw imsOutage; },
      fetch,
    });

    let thrown;
    try {
      await client.GET('/v1/countries');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.equal(imsOutage);
    expect(fetch.called).to.equal(false);
  });

  it('strips embedded credentials from the base URL — never forwards user:pass', async () => {
    const fetch = sandbox.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://user:pass@serenity.example/some/path',
      authToken: 'raw-ims-jwt',
      fetch,
    });

    await client.GET('/v1/countries');

    const { url } = fetch.firstCall.args[0];
    expect(url).to.equal('https://serenity.example/enterprise/projects/api/v1/countries');
    expect(url).to.not.contain('user');
    expect(url).to.not.contain('pass');
  });

  it('resolves the auth token once per request and reuses it across that request\'s retries', async () => {
    let calls = 0;
    const getToken = async () => {
      calls += 1;
      return `token-${calls}`;
    };
    const fetch = sandbox.stub();
    fetch.onCall(0).resolves(json({ err: true }, 503));
    fetch.onCall(1).resolves(json({ ok: true }, 200));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: getToken,
      retryBaseDelayMs: 0,
      fetch,
    });

    const { response } = await client.GET('/v1/countries');

    expect(response.status).to.equal(200);
    expect(fetch.callCount).to.equal(2);
    // The token getter is invoked once per logical request; both physical attempts carry that
    // same token (the retry layer clones the already-authenticated Request).
    expect(calls).to.equal(1);
    expect(fetch.firstCall.args[0].headers.get('Authorization')).to.equal('Bearer token-1');
    expect(fetch.secondCall.args[0].headers.get('Authorization')).to.equal('Bearer token-1');
  });

  it('forwards an onRetry hook to the retry layer', async () => {
    const fetch = sandbox.stub();
    fetch.onCall(0).resolves(json({ err: true }, 503));
    fetch.onCall(1).resolves(json({ ok: true }, 200));
    const retries = [];
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: 'raw-ims-jwt',
      retryBaseDelayMs: 0,
      onRetry: (info) => retries.push(info),
      fetch,
    });

    const { response } = await client.GET('/v1/countries');

    expect(response.status).to.equal(200);
    expect(retries).to.have.length(1);
    expect(retries[0]).to.include({ method: 'GET', status: 503 });
  });

  it('throws at construction when authToken is neither a string nor a function', () => {
    expect(() => createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example',
      authToken: 42,
    })).to.throw(/must be a string or a function/);
  });

  it('threads requestTimeoutMs into the fetch layer (aborts a hung attempt)', async () => {
    // A fetch that never resolves on its own — it settles only when the per-attempt deadline
    // aborts it. With maxRetries 0 the single attempt times out and the abort propagates.
    const fetch = (input, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example',
      authToken: 'raw-ims-jwt',
      maxRetries: 0,
      requestTimeoutMs: 10,
      fetch,
    });

    let thrown;
    try {
      await client.GET('/v1/countries');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.be.an.instanceOf(Error);
    expect(thrown.name).to.equal('TimeoutError');
  });
});
