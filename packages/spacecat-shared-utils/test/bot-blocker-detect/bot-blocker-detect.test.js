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

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import esmock from 'esmock';
import nock from 'nock';
import sinon from 'sinon';

import {
  detectBotBlocker,
  analyzeBotProtection,
  getSpacecatBotIps,
  formatAllowlistMessage,
  SPACECAT_BOT_USER_AGENT,
  BODY_READ_TIMEOUT,
} from '../../src/bot-blocker-detect/bot-blocker-detect.js';

use(sinonChai);

describe('Bot Blocker Detection', () => {
  const baseUrl = 'https://www.example.com';

  before(() => nock.disableNetConnect());
  after(() => nock.enableNetConnect());

  afterEach(() => {
    nock.cleanAll();
  });

  describe('detectBotBlocker', () => {
    it('throws an error if no baseUrl is provided', async () => {
      await expect(detectBotBlocker({})).to.be.rejectedWith('Invalid baseUrl');
    });

    it('throws an error if the baseUrl is invalid', async () => {
      await expect(detectBotBlocker({ baseUrl: 'invalid-url' })).to.be.rejectedWith('Invalid baseUrl');
    });

    it('blocks loopback IP (127.0.0.1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://127.0.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
      expect(result.confidence).to.equal(1.0);
    });

    it('blocks private IP (10.x.x.x) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://10.0.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks private IP (192.168.x.x) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://192.168.1.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks link-local IP (169.254.169.254) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://169.254.169.254/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks private IP (172.16.x.x) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://172.16.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks localhost with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://localhost/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks IPv6 loopback (::1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://[::1]/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks INADDR_ANY (0.0.0.0) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://0.0.0.0/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks IPv6 INADDR_ANY (::) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://[::]/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks IPv6 link-local (fe80::1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://[fe80::1]/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks IPv6 ULA (fc00::1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://[fc00::1]/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks IPv4-mapped IPv6 loopback (::ffff:127.0.0.1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://[::ffff:127.0.0.1]/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks localhost with trailing dot with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://localhost./' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks carrier-grade NAT IP (100.64.0.1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://100.64.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks multicast IP (224.0.0.1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://224.0.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('blocks reserved IP (240.0.0.1) with ssrf-redirect-blocked sentinel', async () => {
      const result = await detectBotBlocker({ baseUrl: 'http://240.0.0.1/' });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
    });

    it('does not block 172.15.255.255 (just outside private range)', async () => {
      nock('http://172.15.255.255').get('/').reply(200, '');
      const result = await detectBotBlocker({ baseUrl: 'http://172.15.255.255/' });
      expect(result.crawlable).to.be.true;
    });

    it('does not block 172.32.0.1 (just outside private range)', async () => {
      nock('http://172.32.0.1').get('/').reply(200, '');
      const result = await detectBotBlocker({ baseUrl: 'http://172.32.0.1/' });
      expect(result.crawlable).to.be.true;
    });

    it('blocks redirect to private IP before connecting', async () => {
      nock('https://www.example.com')
        .get('/')
        .reply(302, undefined, { location: 'http://127.0.0.1/' });
      // the 127.0.0.1 nock is never registered — redirect is blocked before the connection

      const log = { warn: sinon.stub() };
      const result = await detectBotBlocker({ baseUrl, log });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('ssrf-redirect-blocked');
      expect(log.warn).to.have.been.calledWithMatch('redirect to private hostname blocked');
    });

    it('follows a safe redirect and analyses the final response', async () => {
      nock('https://www.example.com')
        .get('/')
        .reply(301, undefined, { location: 'https://www.example.com/final' });
      nock('https://www.example.com')
        .get('/final')
        .reply(200, '');

      const result = await detectBotBlocker({ baseUrl });
      expect(result.crawlable).to.be.true;
    });

    it('returns redirect-limit-exceeded when redirect chain exceeds MAX_REDIRECTS', async () => {
      // Register 11 hops of 302 redirects (MAX_REDIRECTS=10, loop runs 0..10 inclusive)
      for (let i = 0; i <= 10; i += 1) {
        nock('https://www.example.com')
          .get(`/r${i}`)
          .reply(302, undefined, { location: `https://www.example.com/r${i + 1}` });
      }

      const log = { warn: sinon.stub() };
      const result = await detectBotBlocker({ baseUrl: 'https://www.example.com/r0', log });
      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('redirect-limit-exceeded');
      expect(result.confidence).to.equal(0.99);
      expect(log.warn).to.have.been.calledWithMatch('redirect limit exceeded');
    });

    it('handles redirect with unparseable Location header gracefully', async () => {
      // Stub tracingFetch to return a 302 whose Location value is invalid enough
      // that new URL(location, currentUrl) throws — covering the catch { break } path.
      const mockHeaders = new Headers({ location: 'http://' }); // scheme with no host — new URL() throws
      const redirectResp = { status: 302, headers: mockHeaders, text: sinon.stub().resolves('') };
      const finalResp = { status: 200, headers: new Headers({}), text: sinon.stub().resolves('') };
      const fetchStub = sinon.stub();
      fetchStub.onFirstCall().resolves(redirectResp);
      fetchStub.onSecondCall().resolves(finalResp);

      const { detectBotBlocker: detectBotBlockerMocked } = await esmock(
        '../../src/bot-blocker-detect/bot-blocker-detect.js',
        {
          '../../src/tracing-fetch.js': {
            tracingFetch: fetchStub,
            SPACECAT_USER_AGENT: 'test-agent',
          },
          '../../src/functions.js': { isValidUrl: sinon.stub().returns(true) },
          '../../src/network-policy.js': { isNonPublicHostname: sinon.stub().returns(false) },
        },
      );

      const result = await detectBotBlockerMocked({ baseUrl });
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
    });

    it('handles redirect with no Location header gracefully', async () => {
      nock('https://www.example.com')
        .get('/')
        .reply(302, undefined, {});

      const result = await detectBotBlocker({ baseUrl });
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
    });

    it('forwards caller-supplied headers on the probe request', async () => {
      // Mirrors the scraper allowlist case (e.g. Akamai Bot Manager requiring
      // `Accept-Language`): the probe must send the same custom headers the
      // real scraper sends, otherwise it reports a false-positive block.
      nock(baseUrl)
        .matchHeader('Accept-Language', 'en-US')
        .matchHeader('X-Foo', 'bar')
        .get('/')
        .reply(200, '<html></html>');

      const result = await detectBotBlocker({
        baseUrl,
        headers: { 'Accept-Language': 'en-US', 'X-Foo': 'bar' },
      });

      expect(result.crawlable).to.be.true;
    });

    it('overrides caller-supplied User-Agent with SPACECAT_USER_AGENT', async () => {
      // The schema in @adobe/spacecat-shared-data-access blocks User-Agent at
      // write time, but defend in depth: if a caller somehow passes one, the
      // probe must still identify as the scraper UA.
      nock(baseUrl)
        .matchHeader('User-Agent', (v) => v && v !== 'attacker-ua')
        .get('/')
        .reply(200, '<html></html>');

      const result = await detectBotBlocker({
        baseUrl,
        headers: { 'User-Agent': 'attacker-ua' },
      });

      expect(result.crawlable).to.be.true;
    });

    it('detects Cloudflare blocking with 403 and cf-ray header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'cf-ray': '123456789-CDG',
          server: 'cloudflare',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Imperva blocking with 403 and x-iinfo header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-iinfo': 'some-value',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('imperva');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Imperva blocking with 403 and x-cdn Incapsula header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-cdn': 'Incapsula',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('imperva');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects HTTP/2 stream errors', async () => {
      const error = new Error('Stream closed');
      error.code = 'NGHTTP2_INTERNAL_ERROR';

      nock(baseUrl)
        .get('/')
        .replyWithError(error);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('http2-block');
      expect(result.confidence).to.equal(0.95);
    });

    it('detects ERR_HTTP2_STREAM_ERROR', async () => {
      const error = new Error('Stream error');
      error.code = 'ERR_HTTP2_STREAM_ERROR';

      nock(baseUrl)
        .get('/')
        .replyWithError(error);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('http2-block');
      expect(result.confidence).to.equal(0.95);
    });

    it('returns crawlable for 200 OK responses', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('none');
      expect(result.confidence).to.equal(1.0);
    });

    it('returns unknown for unrecognized errors', async () => {
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';

      nock(baseUrl)
        .get('/')
        .replyWithError(error);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.3);
    });

    it('detects 403 as blocked even without known CDN headers', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          server: 'nginx',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
      expect(result.reason).to.equal('HTTP 403 Forbidden - access denied');
    });

    // New CDN detection tests
    it('detects Akamai blocking with 403 and x-akamai-request-id header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-akamai-request-id': 'abc123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Akamai blocking with 403 and x-akamai-session-id header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-akamai-session-id': 'session-123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Akamai blocking with 403 and AkamaiGHost server header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          server: 'AkamaiGHost',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Akamai blocking with 403 and akamai-cache-status header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'akamai-cache-status': 'Error from child',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Akamai blocking with 403 and akamai-grn header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'akamai-grn': '0.12847b5c.1775713505.2874823e',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Fastly blocking with 403 and x-served-by cache header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-served-by': 'cache-sjc10039-SJC',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('fastly');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Fastly blocking with 403 and fastly-io-info header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'fastly-io-info': 'some-value',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('fastly');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects CloudFront blocking with 403 and x-amz-cf-id header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-amz-cf-id': 'cf-id-123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudfront');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects CloudFront blocking with 403 and x-amz-cf-pop header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          'x-amz-cf-pop': 'SEA73-P1',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudfront');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects CloudFront blocking with 403 and via CloudFront header', async () => {
      nock(baseUrl)
        .get('/')
        .reply(403, '', {
          via: '1.1 abc123.cloudfront.net (CloudFront)',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudfront');
      expect(result.confidence).to.equal(0.99);
    });

    // Infrastructure detection on 200 OK responses
    it('detects Cloudflare infrastructure on 200 OK', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, '', {
          'cf-ray': '123456789-CDG',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects Imperva infrastructure on 200 OK', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, '', {
          'x-iinfo': 'some-value',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('imperva-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects Akamai infrastructure on 200 OK', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, '', {
          'x-akamai-request-id': 'abc123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('akamai-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects Fastly infrastructure on 200 OK', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, '', {
          'x-served-by': 'cache-sjc10039-SJC',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('fastly-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects CloudFront infrastructure on 200 OK', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, '', {
          'x-amz-cf-id': 'cf-id-123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudfront-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects Cloudflare challenge page via GET body (200 + cf-ray + JS challenge)', async () => {
      const challengeHtml = '<html><title>Just a moment...</title><body>Checking your browser before accessing the site.</body></html>';
      nock(baseUrl)
        .get('/')
        .reply(200, challengeHtml, { 'cf-ray': '123456789-CDG' });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Imperva challenge page via GET body (200 + x-iinfo + Incapsula pattern)', async () => {
      const challengeHtml = '<html><body>_Incapsula_Resource detected on this page</body></html>';
      nock(baseUrl)
        .get('/')
        .reply(200, challengeHtml, { 'x-iinfo': 'some-value' });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('imperva');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects generic CAPTCHA challenge via GET body (200 + no CDN headers)', async () => {
      const challengeHtml = '<html><body><div class="g-recaptcha" data-sitekey="abc123"></div></body></html>';
      nock(baseUrl)
        .get('/')
        .reply(200, challengeHtml, {});

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('returns cloudflare-allowed for 200 with cf-ray and no challenge patterns in body', async () => {
      nock(baseUrl)
        .get('/')
        .reply(200, 'normal page content', { 'cf-ray': '123456789-CDG' });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
    });

    it('skips body read and uses header-only analysis when Content-Length exceeds cap', async () => {
      const headerMap = { 'content-length': '131072', 'cf-ray': '123-CDG' };
      const mockHeaders = { get: (name) => headerMap[name] ?? null };
      const textStub = sinon.stub().resolves('body content');
      const mockResponse = { status: 200, headers: mockHeaders, text: textStub };

      const { detectBotBlocker: detectBotBlockerMocked } = await esmock(
        '../../src/bot-blocker-detect/bot-blocker-detect.js',
        {
          '../../src/tracing-fetch.js': {
            tracingFetch: sinon.stub().resolves(mockResponse),
            SPACECAT_USER_AGENT: 'test-agent',
          },
          '../../src/functions.js': { isValidUrl: sinon.stub().returns(true) },
        },
      );

      const log = { warn: sinon.stub() };
      const result = await detectBotBlockerMocked({ baseUrl, log });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
      expect(log.warn).to.have.been.calledWithMatch('body too large');
      expect(textStub).not.to.have.been.called;
    });

    it('falls back to header-only analysis when body read exceeds BODY_READ_TIMEOUT', async () => {
      const mockHeaders = { get: (name) => (name === 'cf-ray' ? '123-CDG' : null) };
      // text() returns a promise that never resolves — simulates a slow-streaming body
      const neverResolves = new Promise(() => {});
      const mockResponse = {
        status: 200, headers: mockHeaders, text: sinon.stub().returns(neverResolves),
      };

      // Resolve esmock before installing fake timers — esmock uses dynamic imports internally
      const { detectBotBlocker: detectBotBlockerMocked } = await esmock(
        '../../src/bot-blocker-detect/bot-blocker-detect.js',
        {
          '../../src/tracing-fetch.js': {
            tracingFetch: sinon.stub().resolves(mockResponse),
            SPACECAT_USER_AGENT: 'test-agent',
          },
          '../../src/functions.js': { isValidUrl: sinon.stub().returns(true) },
        },
      );

      const clock = sinon.useFakeTimers();
      const log = { warn: sinon.stub() };
      const promise = detectBotBlockerMocked({ baseUrl, log });
      await clock.tickAsync(BODY_READ_TIMEOUT + 1);
      const result = await promise;
      clock.restore();

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
      expect(log.warn).to.have.been.calledWithMatch('body read failed');
    });

    it('falls back to header-only analysis when response.text() throws', async () => {
      const { detectBotBlocker: detectBotBlockerMocked } = await esmock(
        '../../src/bot-blocker-detect/bot-blocker-detect.js',
        {
          '../../src/tracing-fetch.js': {
            tracingFetch: async () => ({
              status: 200,
              headers: new Headers({ 'cf-ray': '123456789-CDG' }),
              text: () => Promise.reject(new Error('body read failed')),
            }),
            SPACECAT_USER_AGENT: 'SpaceCat/1.0',
          },
        },
      );

      const result = await detectBotBlockerMocked({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
      expect(result.confidence).to.equal(1.0);
    });
  });

  describe('analyzeBotProtection', () => {
    it('detects Cloudflare challenge page with 200 status', () => {
      const html = '<html><title>Just a moment...</title><body>Checking your browser before accessing example.com</body></html>';
      const headers = { 'cf-ray': '123456789-CDG', server: 'cloudflare' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
      expect(result.reason).to.equal('Challenge page detected despite 200 status');
    });

    it('detects Cloudflare challenge page with "Verifying you are human"', () => {
      const html = '<html><body><h1>zepbound.lilly.com</h1><p>Verifying you are human. This may take a few seconds.</p></body></html>';
      const headers = { 'cf-ray': '9a211d4cca225831' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Cloudflare challenge page with turnstile', () => {
      const html = '<html><body><input type="hidden" name="cf-turnstile-response"></body></html>';
      const headers = { 'cf-ray': '123' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
    });

    it('returns cloudflare-allowed when Cloudflare present but no challenge', () => {
      // Create HTML > 10KB to ensure it's not flagged as "suspiciously short"
      const realContent = 'This is real page content. '.repeat(400); // ~11KB
      const html = `<html><head><title>Real Page Title</title></head><body><h1>Welcome to our site</h1><p>${realContent}</p></body></html>`;
      const headers = { 'cf-ray': '123456789-CDG' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    it('detects Imperva challenge page with 200 status', () => {
      const html = '<html><body>_Incapsula_Resource detected</body></html>';
      const headers = { 'x-iinfo': 'some-value' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('imperva');
      expect(result.confidence).to.equal(0.99);
    });

    it('returns imperva-allowed when Imperva present but no challenge', () => {
      // Create HTML > 10KB to ensure it's not flagged as "suspiciously short"
      const realContent = 'Real content with no Imperva patterns. '.repeat(300); // ~12KB
      const html = `<html><body>${realContent}</body></html>`;
      const headers = { 'x-iinfo': 'some-value' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('imperva-allowed');
    });

    it('detects generic CAPTCHA challenge', () => {
      const html = '<html><body><div class="g-recaptcha" data-sitekey="abc123"></div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('works without HTML (backwards compatibility)', () => {
      const headers = { 'cf-ray': '123456789-CDG' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html: null,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudflare-allowed');
    });

    it('works with Headers object', () => {
      const html = '<html><title>Just a moment...</title></html>';
      const headers = new Headers({ 'cf-ray': '123' });

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
    });

    it('detects Cloudflare blocking with 403', () => {
      const html = '<html><body>Access denied</body></html>';
      const headers = { 'cf-ray': '123' };

      const result = analyzeBotProtection({
        status: 403,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
    });

    it('returns none for clean 200 with no protection', () => {
      const html = '<html><body>Normal page content</body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('none');
      expect(result.confidence).to.equal(1.0);
    });

    // New tests for enhanced patterns
    it('detects Cloudflare challenge widget (cf-chl-widget)', () => {
      const html = '<html><body><div id="cf-chl-widget-abc123"></div></body></html>';
      const headers = { 'cf-ray': '123' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
    });

    it('detects Cloudflare challenge token (__cf_chl_tk)', () => {
      const html = '<html><body><input type="hidden" name="__cf_chl_tk" value="xyz"></body></html>';
      const headers = { 'cf-ray': '123' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
    });

    it('detects Imperva session cookie pattern (incap_ses)', () => {
      const html = '<html><body>incap_ses_123_456789 detected</body></html>';
      const headers = { 'x-iinfo': 'some-value' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('imperva');
    });

    it('detects DataDome bot protection', () => {
      const html = '<html><body><script>window.datadome = {};</script></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects reCAPTCHA', () => {
      const html = '<html><body><div class="g-recaptcha"></div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
    });

    it('detects "Press and Hold" challenge', () => {
      const html = '<html><body><div>Press and hold the button to continue</div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects "Click and Hold" challenge', () => {
      const html = '<html><body><button>Click and hold to verify you are human</button></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('does not false-positive on "pressure" and "placeholder" in normal page content', () => {
      const html = '<html><body><p>Monitor your blood pressure at home.</p><input placeholder="Enter value"></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('none');
    });

    it('detects GeeTest interactive challenge', () => {
      const html = '<html><body><div class="geetest_challenge"></div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects Arkose Labs FunCAPTCHA', () => {
      const html = '<html><body><div id="arkose-container"><script>funcaptcha.load();</script></div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects generic interactive challenge', () => {
      const html = '<html><body><div>Complete the interactive challenge to continue</div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects "Prove you are human" challenge', () => {
      const html = '<html><body><p>Please prove you are human before continuing</p></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects "Verify human interaction" challenge', () => {
      const html = '<html><body><div>Please verify your human interaction to continue</div></body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
    });

    it('detects Akamai challenge page', () => {
      const html = '<html><body>Access Denied by Akamai security policy</body></html>';
      const headers = { 'x-akamai-request-id': 'abc123' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
    });

    it('detects Akamai blocking with 403 and akamai-cache-status header', () => {
      const html = '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1></BODY></HTML>';
      const headers = { 'akamai-cache-status': 'Error from child', 'akamai-grn': '0.12847b5c.1775713505.2874823e' };

      const result = analyzeBotProtection({
        status: 403,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Akamai edgesuite.net error page as challenge', () => {
      const html = '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1><P>https://errors.edgesuite.net/18.12847b5c</P></BODY></HTML>';
      const headers = { 'akamai-cache-status': 'Error from child' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
      expect(result.reason).to.equal('Challenge page detected despite 200 status');
    });

    it('detects Akamai edgekey.net error page as challenge', () => {
      const html = '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1><P>https://errors.edgekey.net/18.abc123</P></BODY></HTML>';
      const headers = { 'akamai-cache-status': 'Error from child' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('returns akamai-allowed when akamai-cache-status present on 200 with real content', () => {
      const realContent = 'This is real page content from a site behind Akamai CDN. '.repeat(200);
      const html = `<html><head><title>Real Page</title></head><body>${realContent}</body></html>`;
      const headers = { 'akamai-cache-status': 'Hit from child' };

      const result = analyzeBotProtection({
        status: 200,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('akamai-allowed');
      expect(result.confidence).to.equal(1.0);
    });

    // Tests for generic HTTP error code handling
    it('detects generic 403 Forbidden without known CDN', () => {
      const html = '<html><body>Access denied</body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 403,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.7);
      expect(result.reason).to.equal('HTTP 403 Forbidden - access denied');
    });

    it('does not treat non-bot-protection status codes (429, 401, 406, 4xx, 5xx) as bot protection', () => {
      // Test various status codes that are NOT bot protection
      const testCases = [
        { status: 401, desc: '401 Unauthorized (auth issue, not bot protection)' },
        { status: 406, desc: '406 Not Acceptable (content negotiation, not bot protection)' },
        { status: 418, desc: '418 I\'m a teapot (other 4xx, not bot protection)' },
        { status: 429, desc: '429 Too Many Requests (rate limiting, should retry)' },
        { status: 500, desc: '500 Internal Server Error (server issue, not bot protection)' },
      ];

      testCases.forEach(({ status, desc }) => {
        const result = analyzeBotProtection({
          status,
          headers: {},
          html: '<html><body>Error</body></html>',
        });

        // These should be treated as crawlable (not bot protection)
        expect(result.crawlable, `${desc} should be crawlable`).to.be.true;
        expect(result.type, `${desc} should have type=unknown`).to.equal('unknown');
        expect(result.confidence, `${desc} should have confidence=0.5`).to.equal(0.5);
      });
    });

    it('prioritizes known CDN detection over generic 403', () => {
      // This ensures that if we have both 403 AND Cloudflare headers,
      // we return the more specific 'cloudflare' type, not generic 'unknown'
      const html = '<html><body>Access denied</body></html>';
      const headers = { 'cf-ray': '123456' };

      const result = analyzeBotProtection({
        status: 403,
        headers,
        html,
      });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('cloudflare');
      expect(result.confidence).to.equal(0.99);
    });

    // Edge case: 3xx redirects (not handled by specific rules)
    it('returns unknown with crawlable true for 3xx redirect status codes', () => {
      const html = '<html><body>Redirecting...</body></html>';
      const headers = {};

      const result = analyzeBotProtection({
        status: 301,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
    });

    // Edge case: 1xx informational responses
    it('returns unknown with crawlable true for 1xx informational status codes', () => {
      const html = '';
      const headers = {};

      const result = analyzeBotProtection({
        status: 100,
        headers,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
    });

    // Edge case: Unusual 5xx-range status codes are NOT bot protection
    it('does not treat very unusual 5xx status codes as bot protection', () => {
      const html = '';
      const headers = {};

      const result = analyzeBotProtection({
        status: 999,
        headers,
        html,
      });

      // Server errors (even unusual ones) are NOT bot protection
      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
    });

    // Edge case: No headers provided (null/undefined)
    it('handles null headers gracefully', () => {
      const html = '<html><body>Normal page</body></html>';

      const result = analyzeBotProtection({
        status: 200,
        headers: null,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('none');
      expect(result.confidence).to.equal(1.0);
    });

    // Edge case: Undefined headers
    it('handles undefined headers gracefully', () => {
      const html = '<html><body>Normal page</body></html>';

      const result = analyzeBotProtection({
        status: 200,
        headers: undefined,
        html,
      });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('none');
      expect(result.confidence).to.equal(1.0);
    });
  });

  describe('IP Management Functions', () => {
    describe('getSpacecatBotIps', () => {
      it('should throw error when IPs not provided', () => {
        expect(() => getSpacecatBotIps(null)).to.throw('SPACECAT_BOT_IPS environment variable is required but not set');
        expect(() => getSpacecatBotIps('')).to.throw('SPACECAT_BOT_IPS environment variable is required but not set');
        expect(() => getSpacecatBotIps(undefined)).to.throw('SPACECAT_BOT_IPS environment variable is required but not set');
      });

      it('should parse comma-separated IPs', () => {
        const botIps = '1.2.3.4,5.6.7.8,9.10.11.12';
        const ips = getSpacecatBotIps(botIps);

        expect(ips).to.deep.equal(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
      });

      it('should trim whitespace from IP addresses', () => {
        const botIps = ' 1.2.3.4 , 5.6.7.8 , 9.10.11.12 ';
        const ips = getSpacecatBotIps(botIps);

        expect(ips).to.deep.equal(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
      });

      it('should filter out empty IP entries', () => {
        const botIps = '1.2.3.4,,5.6.7.8,  ,9.10.11.12';
        const ips = getSpacecatBotIps(botIps);

        expect(ips).to.deep.equal(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
      });

      it('should handle single IP', () => {
        const botIps = '192.168.1.1';
        const ips = getSpacecatBotIps(botIps);

        expect(ips).to.deep.equal(['192.168.1.1']);
      });
    });

    describe('formatAllowlistMessage', () => {
      it('should format allowlist message with IPs', () => {
        const botIps = '1.2.3.4,5.6.7.8,9.10.11.12';
        const message = formatAllowlistMessage(botIps);

        expect(message).to.deep.equal({
          title: 'To allowlist SpaceCat bot:',
          ips: ['1.2.3.4', '5.6.7.8', '9.10.11.12'],
          userAgent: SPACECAT_BOT_USER_AGENT,
        });
      });

      it('should throw error when IPs not provided', () => {
        expect(() => formatAllowlistMessage(null)).to.throw('SPACECAT_BOT_IPS environment variable is required but not set');
      });

      it('should include correct user-agent', () => {
        const botIps = '1.2.3.4';
        const message = formatAllowlistMessage(botIps);

        expect(message.userAgent).to.equal('Spacecat/1.0');
      });
    });
  });
});
