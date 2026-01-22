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

import { detectBotBlocker } from '../../src/bot-blocker-detect/bot-blocker-detect.js';

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

    it('returns unknown for unrecognized status codes', async () => {
      nock(baseUrl)
        .head('/')
        .reply(500);

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
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

    it('does not detect blocking for 403 without known headers', async () => {
      nock(baseUrl)
        .head('/')
        .reply(403, '', {
          server: 'nginx',
        });

      const result = await detectBotBlocker({ baseUrl });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
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
});
