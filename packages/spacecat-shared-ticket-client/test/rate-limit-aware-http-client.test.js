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

import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import RateLimitAwareHttpClient from '../src/http/rate-limit-aware-http-client.js';

chai.use(chaiAsPromised);
const { expect } = chai;

function makeLog() {
  return {
    info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
  };
}

function makeResponse(status, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => headers[key] ?? null },
  };
}

describe('RateLimitAwareHttpClient', () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore(); // restores any remaining stubs (e.g. Math.random)
  });

  it('passes through non-429 responses immediately', async () => {
    const inner = { fetch: sinon.stub().resolves(makeResponse(200)) };
    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const res = await client.fetch('https://api.atlassian.com/issue', {});

    expect(res.status).to.equal(200);
    expect(inner.fetch.calledOnce).to.be.true;
  });

  it('retries after a 429 and returns 200 on the next call', async () => {
    const inner = { fetch: sinon.stub() };
    inner.fetch.onFirstCall().resolves(makeResponse(429, { 'Retry-After': '1' }));
    inner.fetch.onSecondCall().resolves(makeResponse(200));

    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    await clock.tickAsync(1100);
    const res = await fetchPromise;

    expect(res.status).to.equal(200);
    expect(inner.fetch.callCount).to.equal(2);
  });

  it('fails fast (no retry) when RateLimit-Reason indicates global quota exhaustion', async () => {
    const inner = {
      fetch: sinon.stub().resolves(
        makeResponse(429, { 'RateLimit-Reason': 'jira-quota-global-based' }),
      ),
    };
    const log = makeLog();
    const client = new RateLimitAwareHttpClient(inner, log);

    const res = await client.fetch('https://api.atlassian.com/issue', {});

    expect(res.status).to.equal(429);
    expect(inner.fetch.callCount).to.equal(1); // no retries
    expect(log.warn.calledOnce).to.be.true;
    expect(log.warn.firstCall.args[0]).to.include('quota exhausted');
  });

  it('fails fast (no retry) when RateLimit-Reason indicates tenant quota exhaustion', async () => {
    const inner = {
      fetch: sinon.stub().resolves(
        makeResponse(429, { 'RateLimit-Reason': 'jira-quota-tenant-based' }),
      ),
    };
    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const res = await client.fetch('https://api.atlassian.com/issue', {});

    expect(res.status).to.equal(429);
    expect(inner.fetch.callCount).to.equal(1);
  });

  it('fails fast on mixed-case RateLimit-Reason (case-insensitive matching)', async () => {
    const inner = {
      fetch: sinon.stub().resolves(
        makeResponse(429, { 'RateLimit-Reason': 'Jira-Quota-Global-Based' }),
      ),
    };
    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const res = await client.fetch('https://api.atlassian.com/issue', {});

    expect(res.status).to.equal(429);
    expect(inner.fetch.callCount).to.equal(1);
  });

  it('retries up to MAX_RETRIES (4) times then returns the 429 response', async () => {
    // Use Retry-After: 1 for deterministic 1-second waits (no jitter).
    // Tick in four 1.1 s steps so each step completes one pending setTimeout.
    const inner = {
      fetch: sinon.stub().resolves(makeResponse(429, { 'Retry-After': '1' })),
    };
    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(1100);
    }
    const res = await fetchPromise;

    expect(res.status).to.equal(429);
    expect(inner.fetch.callCount).to.equal(5); // 1 initial + 4 retries
  });

  it('uses Retry-After header: each wait equals the header value exactly', async () => {
    const callTimes = [];
    const inner = {
      fetch: sinon.stub().callsFake(() => {
        callTimes.push(clock.now);
        return Promise.resolve(makeResponse(429, { 'Retry-After': '2' }));
      }),
    };
    const client = new RateLimitAwareHttpClient(inner, makeLog());

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(2100);
    }
    await fetchPromise;

    expect(callTimes).to.have.length(5);
    expect(callTimes[1] - callTimes[0]).to.equal(2000);
    expect(callTimes[2] - callTimes[1]).to.equal(2000);
    expect(callTimes[3] - callTimes[2]).to.equal(2000);
    expect(callTimes[4] - callTimes[3]).to.equal(2000);
  });

  it('exponential backoff without Retry-After produces monotonically-growing waits', async () => {
    // Stub Math.random → 0 so jitter = 0.7 (minimum, deterministic).
    // BASE_BACKOFF_MS=2000, so waits: 1400, 2800, 5600, 11200 ms.
    sinon.stub(Math, 'random').returns(0);

    const capturedWaits = [];
    const inner = {
      fetch: sinon.stub().callsFake(() => Promise.resolve(makeResponse(429))),
    };
    const log = {
      warn: (msg, meta) => {
        if (meta?.waitMs !== undefined) {
          capturedWaits.push(meta.waitMs);
        }
      },
      debug: () => {},
    };
    const client = new RateLimitAwareHttpClient(inner, log);

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    // With deterministic jitter=0.7, total = 1400+2800+5600+11200 = 21000 ms.
    // Tick in steps — each step >11200 ms ensures each setTimeout fires.
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(12000);
    }
    await fetchPromise;

    expect(capturedWaits).to.have.length(4);
    expect(capturedWaits[0]).to.equal(1400); // round(2000×1×0.7)
    expect(capturedWaits[1]).to.equal(2800); // round(2000×2×0.7)
    expect(capturedWaits[2]).to.equal(5600); // round(2000×4×0.7)
    expect(capturedWaits[3]).to.equal(11200); // round(2000×8×0.7)
  });

  it('caps Retry-After at MAX_WAIT_MS (30 s)', async () => {
    const inner = {
      fetch: sinon.stub()
        .onFirstCall()
        .resolves(makeResponse(429, { 'Retry-After': '60' })) // 60s > 30s cap
        .onSecondCall()
        .resolves(makeResponse(200)),
    };
    const log = makeLog();
    const client = new RateLimitAwareHttpClient(inner, log);

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    await clock.tickAsync(30100); // exactly at cap
    const res = await fetchPromise;

    expect(res.status).to.equal(200);
    // waitMs in warn log should be 30 000 (capped)
    expect(log.warn.firstCall.args[1]).to.have.property('waitMs', 30000);
  });

  it('logs a warning on each 429 retry attempt', async () => {
    const inner = { fetch: sinon.stub() };
    inner.fetch.onFirstCall().resolves(makeResponse(429, { 'Retry-After': '1' }));
    inner.fetch.onSecondCall().resolves(makeResponse(200));

    const log = makeLog();
    const client = new RateLimitAwareHttpClient(inner, log);

    const fetchPromise = client.fetch('https://api.atlassian.com/issue', {});
    await clock.tickAsync(1100);
    await fetchPromise;

    expect(log.warn.calledOnce).to.be.true;
    expect(log.warn.firstCall.args[0]).to.include('backing off');
  });

  it('retries 503 with backoff (transient server error)', async () => {
    const innerFetch = sinon.stub();
    innerFetch.onFirstCall().resolves({ status: 503, headers: { get: () => null } });
    innerFetch.onSecondCall().resolves({ status: 200, headers: { get: () => null } });
    const httpClient = new RateLimitAwareHttpClient({ fetch: innerFetch }, makeLog());

    const promise = httpClient.fetch('https://api.atlassian.com/test', {});
    await clock.tickAsync(3000); // 2s base * jitter
    const result = await promise;
    expect(result.status).to.equal(200);
    expect(innerFetch.callCount).to.equal(2);
  });

  it('does not retry 501 Not Implemented (non-transient)', async () => {
    const innerFetch = sinon.stub().resolves({ status: 501, headers: { get: () => null } });
    const httpClient = new RateLimitAwareHttpClient({ fetch: innerFetch }, makeLog());
    const result = await httpClient.fetch('https://api.atlassian.com/test', {});
    expect(result.status).to.equal(501);
    expect(innerFetch.callCount).to.equal(1);
  });

  it('injects AbortSignal into fetch and re-throws after all retries exhaust on timeout', async () => {
    // AbortSignal.timeout() uses native timers that sinon cannot fake.
    // We simulate the timeout firing by having innerFetch immediately reject with a
    // TimeoutError — the same error AbortSignal.timeout() would cause in production.
    // The retry loop must: (a) retry on each timeout, (b) throw on the last attempt.
    let capturedSignal;
    const innerFetch = sinon.stub().callsFake((_url, opts) => {
      capturedSignal = opts?.signal;
      return Promise.reject(Object.assign(new Error('TimeoutError'), { name: 'TimeoutError' }));
    });
    const httpClient = new RateLimitAwareHttpClient({ fetch: innerFetch }, makeLog());

    const promise = httpClient.fetch('https://api.atlassian.com/slow', {});
    // Tick through all 4 retry backoff waits (max 30s each with Retry-After cap).
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(30100);
    }
    await expect(promise).to.be.rejectedWith('TimeoutError');
    // The implementation must inject a signal (AbortSignal.timeout) for every attempt.
    expect(capturedSignal).to.exist;
    // innerFetch called once per attempt: 1 initial + 4 retries = 5.
    expect(innerFetch.callCount).to.equal(5);
  });

  describe('non-idempotent method safety (POST/PUT/PATCH)', () => {
    it('does not retry 5xx on POST — returns response immediately', async () => {
      const inner = { fetch: sinon.stub().resolves(makeResponse(503)) };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      const res = await client.fetch('https://api.atlassian.com/issue', { method: 'POST' });

      expect(res.status).to.equal(503);
      expect(inner.fetch.callCount).to.equal(1);
      expect(log.warn.calledOnce).to.be.true;
      expect(log.warn.firstCall.args[0]).to.include('non-idempotent');
    });

    it('does not retry 5xx on PUT — returns response immediately', async () => {
      const inner = { fetch: sinon.stub().resolves(makeResponse(502)) };
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      const res = await client.fetch('https://api.atlassian.com/issue', { method: 'PUT' });

      expect(res.status).to.equal(502);
      expect(inner.fetch.callCount).to.equal(1);
    });

    it('does not retry network errors on POST — throws immediately', async () => {
      const inner = { fetch: sinon.stub().rejects(new Error('ECONNRESET')) };
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      await expect(
        client.fetch('https://api.atlassian.com/issue', { method: 'POST' }),
      ).to.be.rejectedWith('ECONNRESET');

      expect(inner.fetch.callCount).to.equal(1);
    });

    it('still retries 429 on POST — rate-limited requests were never processed', async () => {
      const inner = { fetch: sinon.stub() };
      inner.fetch.onFirstCall().resolves(makeResponse(429, { 'Retry-After': '1' }));
      inner.fetch.onSecondCall().resolves(makeResponse(201));
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      const promise = client.fetch('https://api.atlassian.com/issue', { method: 'POST' });
      await clock.tickAsync(1100);
      const res = await promise;

      expect(res.status).to.equal(201);
      expect(inner.fetch.callCount).to.equal(2);
    });

    it('retries 5xx on GET — idempotent method is safe to retry', async () => {
      const inner = { fetch: sinon.stub() };
      inner.fetch.onFirstCall().resolves(makeResponse(503));
      inner.fetch.onSecondCall().resolves(makeResponse(200));
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      const promise = client.fetch('https://api.atlassian.com/projects', { method: 'GET' });
      await clock.tickAsync(3000);
      const res = await promise;

      expect(res.status).to.equal(200);
      expect(inner.fetch.callCount).to.equal(2);
    });

    it('retries network errors on GET — idempotent method is safe to retry', async () => {
      const inner = { fetch: sinon.stub() };
      inner.fetch.onFirstCall().rejects(new Error('ECONNRESET'));
      inner.fetch.onSecondCall().resolves(makeResponse(200));
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      const promise = client.fetch('https://api.atlassian.com/projects', { method: 'GET' });
      await clock.tickAsync(3000);
      const res = await promise;

      expect(res.status).to.equal(200);
      expect(inner.fetch.callCount).to.equal(2);
    });

    it('defaults to GET when options.method is not specified', async () => {
      const inner = { fetch: sinon.stub() };
      inner.fetch.onFirstCall().resolves(makeResponse(503));
      inner.fetch.onSecondCall().resolves(makeResponse(200));
      const client = new RateLimitAwareHttpClient(inner, makeLog());

      const promise = client.fetch('https://api.atlassian.com/projects', {});
      await clock.tickAsync(3000);
      const res = await promise;

      // Defaults to GET → safe to retry
      expect(res.status).to.equal(200);
      expect(inner.fetch.callCount).to.equal(2);
    });
  });

  describe('X-RateLimit quota headers', () => {
    it('logs a warning when X-RateLimit-NearLimit is true, including remaining and limit', async () => {
      const inner = {
        fetch: sinon.stub().resolves(makeResponse(200, {
          'X-RateLimit-NearLimit': 'true',
          'X-RateLimit-Remaining': '500',
          'X-RateLimit-Limit': '65000',
        })),
      };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.warn.calledOnce).to.be.true;
      expect(log.warn.firstCall.args[0]).to.include('quota running low');
      expect(log.warn.firstCall.args[1]).to.deep.include({ remaining: 500, limit: '65000' });
    });

    it('warns with undefined remaining/limit when NearLimit is true but those headers are absent', async () => {
      const inner = {
        fetch: sinon.stub().resolves(makeResponse(200, { 'X-RateLimit-NearLimit': 'true' })),
      };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.warn.calledOnce).to.be.true;
      expect(log.warn.firstCall.args[1]).to.deep.include({
        remaining: undefined,
        limit: undefined,
      });
    });

    it('does not warn when X-RateLimit-NearLimit is absent', async () => {
      const inner = {
        fetch: sinon.stub().resolves(makeResponse(200, { 'X-RateLimit-Remaining': '500' })),
      };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.warn.called).to.be.false;
    });

    it('logs debug with resetAt when X-RateLimit-Reset header is present', async () => {
      const resetAt = '2026-06-23T10:00:00Z';
      const inner = {
        fetch: sinon.stub().resolves(makeResponse(200, { 'X-RateLimit-Reset': resetAt })),
      };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.debug.calledOnce).to.be.true;
      expect(log.debug.firstCall.args[0]).to.include('rate-limit window');
      expect(log.debug.firstCall.args[1]).to.deep.include({ resetAt });
    });

    it('includes resetAt in the low-quota warning when NearLimit and Reset are present', async () => {
      const resetAt = '2026-06-23T10:00:00Z';
      const inner = {
        fetch: sinon.stub().resolves(makeResponse(200, {
          'X-RateLimit-NearLimit': 'true',
          'X-RateLimit-Remaining': '100',
          'X-RateLimit-Reset': resetAt,
        })),
      };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.warn.calledOnce).to.be.true;
      expect(log.warn.firstCall.args[1]).to.deep.include({ resetAt });
    });

    it('does not emit debug log when X-RateLimit-Reset header is absent', async () => {
      const inner = { fetch: sinon.stub().resolves(makeResponse(200)) };
      const log = makeLog();
      const client = new RateLimitAwareHttpClient(inner, log);

      await client.fetch('https://api.atlassian.com/issue', {});

      expect(log.debug.called).to.be.false;
    });
  });
});
