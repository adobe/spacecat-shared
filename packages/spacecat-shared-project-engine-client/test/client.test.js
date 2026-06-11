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

describe('createSerenityProjectEngineApiClient', () => {
  it('forwards a static IMS token verbatim as the Auth-Data-Jwt header', async () => {
    const fetch = sinon.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: 'raw-ims-jwt',
      fetch,
    });

    await client.GET('/v1/countries');

    expect(fetch.callCount).to.equal(1);
    const request = fetch.firstCall.args[0];
    expect(request.headers.get('Auth-Data-Jwt')).to.equal('raw-ims-jwt');
    expect(request.url).to.equal('https://serenity.example/enterprise/projects/api/v1/countries');
  });

  it('resolves an async token getter per request (no token captured at construction)', async () => {
    const fetch = sinon.stub().callsFake(() => Promise.resolve(json({ ok: true })));
    let current = 'token-1';
    const client = createSerenityProjectEngineApiClient({
      baseUrl: 'https://serenity.example/enterprise/projects/api',
      authToken: async () => current,
      fetch,
    });

    await client.GET('/v1/countries');
    current = 'token-2';
    await client.GET('/v1/countries');

    expect(fetch.firstCall.args[0].headers.get('Auth-Data-Jwt')).to.equal('token-1');
    expect(fetch.secondCall.args[0].headers.get('Auth-Data-Jwt')).to.equal('token-2');
  });

  it('applies retry defaults: retries a retryable 5xx GET', async () => {
    const fetch = sinon.stub();
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
    const fetch = sinon.stub().callsFake(() => Promise.resolve(json({ ok: true })));
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
});
