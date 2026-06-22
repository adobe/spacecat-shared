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
import {
  createRetryingFetch,
  isRetryableStatus,
  methodOf,
  nextRetryDelayMs,
  parseRetryAfterMs,
  toTokenGetter,
  MAX_RETRY_DELAY_MS,
} from '../src/internal.js';

const sandbox = sinon.createSandbox();
afterEach(() => sandbox.restore());

const resp = (status, headers) => new Response(null, { status, headers });

describe('methodOf', () => {
  it('reads the method from init when present', () => {
    expect(methodOf('https://x', { method: 'post' })).to.equal('POST');
  });

  it('falls back to a Request input method', () => {
    expect(methodOf(new Request('https://x', { method: 'delete' }))).to.equal('DELETE');
  });

  it('defaults to GET for a bare URL with no init', () => {
    expect(methodOf('https://x')).to.equal('GET');
  });
});

describe('isRetryableStatus', () => {
  it('retries 429 for any method', () => {
    expect(isRetryableStatus('POST', 429)).to.equal(true);
    expect(isRetryableStatus('GET', 429)).to.equal(true);
  });

  it('retries 5xx only for idempotent methods', () => {
    expect(isRetryableStatus('GET', 503)).to.equal(true);
    expect(isRetryableStatus('PUT', 500)).to.equal(true);
    expect(isRetryableStatus('POST', 503)).to.equal(false);
    expect(isRetryableStatus('PATCH', 502)).to.equal(false);
  });

  it('does not retry 2xx or non-429 4xx', () => {
    expect(isRetryableStatus('GET', 200)).to.equal(false);
    expect(isRetryableStatus('GET', 404)).to.equal(false);
  });
});

describe('createRetryingFetch', () => {
  it('retries a retryable GET and returns the eventual success', async () => {
    const base = sandbox.stub();
    base.onCall(0).resolves(resp(503));
    base.onCall(1).resolves(resp(200));
    const res = await createRetryingFetch(base, 2, 0)('https://x/v1/countries', { method: 'GET' });
    expect(res.status).to.equal(200);
    expect(base.callCount).to.equal(2);
  });

  it('does not retry a 5xx POST (avoids replaying a possible write)', async () => {
    const base = sandbox.stub().resolves(resp(503));
    const res = await createRetryingFetch(base, 2, 0)('https://x', { method: 'POST' });
    expect(res.status).to.equal(503);
    expect(base.callCount).to.equal(1);
  });

  it('retries a 429 even on POST', async () => {
    const base = sandbox.stub();
    base.onCall(0).resolves(resp(429));
    base.onCall(1).resolves(resp(201));
    const res = await createRetryingFetch(base, 2, 0)('https://x', { method: 'POST' });
    expect(res.status).to.equal(201);
    expect(base.callCount).to.equal(2);
  });

  // Regression: openapi-fetch hands us a Request object, and reading its body (as real
  // fetch does) marks it used — a bare replay would throw "Request ... already used".
  // These two assert the per-attempt clone actually re-sends the body on retry.
  it('re-sends a bodied idempotent Request on retry (clones rather than replaying)', async () => {
    const seenBodies = [];
    const base = sandbox.stub().callsFake(async (req) => {
      seenBodies.push(await req.text());
      return resp(seenBodies.length === 1 ? 503 : 200);
    });
    const request = new Request('https://x/v1/projects', {
      method: 'PUT',
      body: JSON.stringify({ name: 'p' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await createRetryingFetch(base, 2, 0)(request);
    expect(res.status).to.equal(200);
    expect(base.callCount).to.equal(2);
    expect(seenBodies).to.deep.equal(['{"name":"p"}', '{"name":"p"}']);
  });

  it('retries a 429 on a bodied POST without consuming the original Request', async () => {
    const consume = async (req, status) => {
      await req.text();
      return resp(status);
    };
    const base = sandbox.stub();
    base.onCall(0).callsFake((req) => consume(req, 429));
    base.onCall(1).callsFake((req) => consume(req, 201));
    const request = new Request('https://x/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'p' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await createRetryingFetch(base, 2, 0)(request);
    expect(res.status).to.equal(201);
    expect(base.callCount).to.equal(2);
  });

  it('returns the last retryable response after exhausting retries', async () => {
    const base = sandbox.stub().resolves(resp(503));
    const res = await createRetryingFetch(base, 2, 0)('https://x', { method: 'GET' });
    expect(res.status).to.equal(503);
    expect(base.callCount).to.equal(3);
  });

  it('makes exactly one attempt when maxRetries is 0 (no retry)', async () => {
    const base = sandbox.stub().resolves(resp(503));
    const res = await createRetryingFetch(base, 0, 0)('https://x', { method: 'GET' });
    expect(res.status).to.equal(503);
    expect(base.callCount).to.equal(1);
  });

  it('treats a negative maxRetries as zero (single attempt, never throws undefined)', async () => {
    const base = sandbox.stub().resolves(resp(503));
    const res = await createRetryingFetch(base, -3, 0)('https://x', { method: 'GET' });
    expect(res.status).to.equal(503);
    expect(base.callCount).to.equal(1);
  });

  it('retries network errors for idempotent methods, then rethrows if persistent', async () => {
    const base = sandbox.stub().rejects(new Error('network down'));
    try {
      await createRetryingFetch(base, 1, 0)('https://x', { method: 'GET' });
      expect.fail('expected the persistent network error to be rethrown');
    } catch (error) {
      expect(error.message).to.equal('network down');
    }
    expect(base.callCount).to.equal(2);
  });

  it('does not retry network errors for non-idempotent methods', async () => {
    const base = sandbox.stub().rejects(new Error('boom'));
    try {
      await createRetryingFetch(base, 2, 0)('https://x', { method: 'POST' });
      expect.fail('expected the network error to be rethrown without retry');
    } catch (error) {
      expect(error.message).to.equal('boom');
    }
    expect(base.callCount).to.equal(1);
  });
});

describe('createRetryingFetch onRetry hook', () => {
  it('invokes onRetry before each retry with the triggering status', async () => {
    const base = sandbox.stub();
    base.onCall(0).resolves(resp(503));
    base.onCall(1).resolves(resp(200));
    const calls = [];
    const res = await createRetryingFetch(base, 2, 0, (info) => calls.push(info))('https://x', { method: 'GET' });
    expect(res.status).to.equal(200);
    expect(calls).to.have.length(1);
    expect(calls[0]).to.include({
      attempt: 1, delayMs: 0, method: 'GET', status: 503,
    });
    expect(calls[0].error).to.equal(undefined);
  });

  it('invokes onRetry with the network error (and no status) on an error retry', async () => {
    const boom = new Error('network down');
    const base = sandbox.stub();
    base.onCall(0).rejects(boom);
    base.onCall(1).resolves(resp(200));
    const calls = [];
    const res = await createRetryingFetch(base, 2, 0, (info) => calls.push(info))('https://x', { method: 'GET' });
    expect(res.status).to.equal(200);
    expect(calls).to.have.length(1);
    expect(calls[0].error).to.equal(boom);
    expect(calls[0].status).to.equal(undefined);
  });

  it('swallows a throwing onRetry and still completes the request', async () => {
    const base = sandbox.stub();
    base.onCall(0).resolves(resp(503));
    base.onCall(1).resolves(resp(200));
    const onRetry = () => {
      throw new Error('observer boom');
    };
    const res = await createRetryingFetch(base, 2, 0, onRetry)('https://x', { method: 'GET' });
    expect(res.status).to.equal(200);
    expect(base.callCount).to.equal(2);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses a delta-seconds value into milliseconds', () => {
    expect(parseRetryAfterMs(resp(429, { 'retry-after': '5' }))).to.equal(5000);
  });

  it('returns null when the header is absent', () => {
    expect(parseRetryAfterMs(resp(429))).to.equal(null);
  });

  it('returns null for an unparseable value', () => {
    expect(parseRetryAfterMs(resp(429, { 'retry-after': 'soon' }))).to.equal(null);
  });

  it('floors a negative delta-seconds value at zero', () => {
    expect(parseRetryAfterMs(resp(429, { 'retry-after': '-5' }))).to.equal(0);
  });

  it('parses an HTTP-date into the delay until then', () => {
    const whenMs = Date.now() + 3000;
    const ms = parseRetryAfterMs(resp(429, { 'retry-after': new Date(whenMs).toUTCString() }));
    // HTTP-date carries whole-second resolution, so allow a small window.
    expect(ms).to.be.within(1500, 3000);
  });

  it('floors a past HTTP-date at zero', () => {
    const past = new Date(Date.now() - 10000).toUTCString();
    expect(parseRetryAfterMs(resp(429, { 'retry-after': past }))).to.equal(0);
  });
});

describe('nextRetryDelayMs', () => {
  it('applies equal jitter to exponential backoff: floor at 0.5x', () => {
    sandbox.stub(Math, 'random').returns(0);
    // completedAttempt 0 -> backoff = base * 2**0 = 200; jitter factor 0.5 -> 100
    expect(nextRetryDelayMs(0, 200, null)).to.equal(100);
  });

  it('grows the backoff exponentially per attempt before jitter', () => {
    sandbox.stub(Math, 'random').returns(1);
    // completedAttempt 2 -> backoff = 200 * 2**2 = 800; jitter factor ~1 -> ~800
    expect(nextRetryDelayMs(2, 200, null)).to.be.closeTo(800, 1);
  });

  it('never waits less than the server-requested Retry-After', () => {
    sandbox.stub(Math, 'random').returns(0);
    // jittered backoff (100) is dwarfed by the 5s Retry-After
    const ms = nextRetryDelayMs(0, 200, resp(429, { 'retry-after': '5' }));
    expect(ms).to.equal(5000);
  });

  it('still uses jittered backoff when it exceeds a small Retry-After', () => {
    sandbox.stub(Math, 'random').returns(1);
    // backoff 800 > Retry-After 0.1s (100ms) -> keep backoff
    const ms = nextRetryDelayMs(2, 200, resp(429, { 'retry-after': '0.1' }));
    expect(ms).to.be.closeTo(800, 1);
  });

  it('clamps a hostile Retry-After to the ceiling', () => {
    sandbox.stub(Math, 'random').returns(0);
    const ms = nextRetryDelayMs(0, 200, resp(429, { 'retry-after': '99999' }));
    expect(ms).to.equal(MAX_RETRY_DELAY_MS);
  });
});

describe('toTokenGetter (IMS token source)', () => {
  it('wraps a static token', async () => {
    expect(await toTokenGetter('ims-token-123')()).to.equal('ims-token-123');
  });

  it('passes through an async getter for per-request tokens', async () => {
    expect(await toTokenGetter(async () => 'fresh-ims')()).to.equal('fresh-ims');
  });

  it('throws for a non-string, non-function source (surfaces misconfig early)', () => {
    expect(() => toTokenGetter(null)).to.throw(/must be a string or a function/);
    expect(() => toTokenGetter(42)).to.throw(/must be a string or a function/);
    expect(() => toTokenGetter({})).to.throw(/must be a string or a function/);
  });
});
