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

    it('respects custom timeout', async () => {
      nock(baseUrl)
        .head('/')
        .delay(100)
        .reply(200);

      const result = await detectBotBlocker({ baseUrl, timeout: 50 });

      expect(result.crawlable).to.be.true;
      expect(result.type).to.equal('unknown');
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
  });
});
