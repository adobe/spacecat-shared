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

/* eslint-env mocha */

import { expect } from 'chai';
import nock from 'nock';

import {
  detectBotBlocker,
  analyzeBotProtection,
  getSpacecatBotIps,
  formatAllowlistMessage,
  SPACECAT_BOT_USER_AGENT,
} from '../../src/bot-blocker-detect/bot-blocker-detect.js';

describe('Bot Blocker Detection', () => {
  const baseUrl = 'https://www.example.com';

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

    it('detects Cloudflare blocking with 403 and cf-ray header', async () => {
      nock(baseUrl)
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
        .replyWithError(error);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('http2-block');
      expect(result.confidence).to.equal(0.95);
    });

    it('returns crawlable for 200 OK responses', async () => {
      nock(baseUrl)
        .head('/')
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
        .head('/')
        .replyWithError(error);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.3);
    });

    it('detects 403 as blocked even without known CDN headers', async () => {
      nock(baseUrl)
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
        .reply(403, '', {
          server: 'AkamaiGHost',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.false;
      expect(result.type).to.equal('akamai');
      expect(result.confidence).to.equal(0.99);
    });

    it('detects Fastly blocking with 403 and x-served-by cache header', async () => {
      nock(baseUrl)
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
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
        .head('/')
        .reply(200, '', {
          'x-amz-cf-id': 'cf-id-123',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('cloudfront-allowed');
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
