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
  classifyProbeResponse,
  BOT_CHALLENGE_KEYWORDS,
  HARD_BLOCK_STATUS_CODES,
  PRIVATE_HOST_RE,
  WAF_PROBE_TIMEOUT_MS,
  EDGE_OPTIMIZE_PROXY_BASE_URL_DEFAULT,
} from '../../src/utils/waf-probe-utils.js';

function makeResponse(status, headers = {}, body = '') {
  return {
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

describe('waf-probe-utils', () => {
  let log;

  beforeEach(() => {
    log = { info: sinon.stub() };
  });

  // ── Exported constants ──────────────────────────────────────────────────────

  describe('constants', () => {
    it('exports the correct proxy base URL', () => {
      expect(EDGE_OPTIMIZE_PROXY_BASE_URL_DEFAULT).to.equal('https://live.edgeoptimize.net');
    });

    it('exports the correct timeout', () => {
      expect(WAF_PROBE_TIMEOUT_MS).to.equal(15000);
    });

    it('HARD_BLOCK_STATUS_CODES covers expected codes', () => {
      const hardCodes = [401, 403, 406, 429, 503];
      expect(hardCodes.every((code) => HARD_BLOCK_STATUS_CODES.has(code))).to.be.true;
      expect(HARD_BLOCK_STATUS_CODES.has(200)).to.be.false;
    });

    it('PRIVATE_HOST_RE blocks loopback, link-local, and RFC1918 ranges', () => {
      ['localhost', '127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.1.1'].forEach(
        (host) => expect(PRIVATE_HOST_RE.test(host), host).to.be.true,
      );
      expect(PRIVATE_HOST_RE.test('example.com')).to.be.false;
    });

    it('BOT_CHALLENGE_KEYWORDS are all vendor-specific identifiers', () => {
      expect(BOT_CHALLENGE_KEYWORDS).to.be.an('array').with.length.above(0);
      // Broad natural-language terms must not appear — they cause false positives
      ['challenge', 'captcha', 'access denied'].forEach(
        (broad) => expect(BOT_CHALLENGE_KEYWORDS).to.not.include(broad),
      );
    });
  });

  // ── classifyProbeResponse ───────────────────────────────────────────────────

  describe('classifyProbeResponse', () => {
    describe('hard block status codes', () => {
      [401, 403, 406, 429, 503].forEach((code) => {
        it(`classifies HTTP ${code} as blocked`, async () => {
          const result = await classifyProbeResponse(makeResponse(code), 'example.com', log);
          expect(result).to.deep.equal({ reachable: false, blocked: true, statusCode: code });
        });
      });
    });

    describe('Cloudflare active challenge', () => {
      it('classifies cf-mitigated: challenge header as blocked on 200', async () => {
        const response = makeResponse(200, { 'cf-mitigated': 'challenge' });
        const result = await classifyProbeResponse(response, 'example.com', log);
        expect(result).to.deep.equal({ reachable: false, blocked: true, statusCode: 200 });
      });

      it('classifies cf-mitigated: challenge header as blocked on non-block status', async () => {
        const response = makeResponse(202, { 'cf-mitigated': 'challenge' });
        const result = await classifyProbeResponse(response, 'example.com', log);
        expect(result).to.deep.equal({ reachable: false, blocked: true, statusCode: 202 });
      });
    });

    describe('soft block — vendor keyword detection', () => {
      [
        ['Cloudflare widget class', 'cf-chl-widget', '<div class="cf-chl-widget"></div>'],
        ['Cloudflare challenge phrase', 'completing the challenge', 'Please completing the challenge to continue'],
        ['Imperva artifact', '_incapsula_resource', 'window._incapsula_resource={}'],
        ['Akamai edgesuite domain', 'errors.edgesuite.net', 'See errors.edgesuite.net for details'],
        ['Akamai edgekey domain', 'errors.edgekey.net', 'See errors.edgekey.net for details'],
      ].forEach(([label, , body]) => {
        it(`detects soft block: ${label}`, async () => {
          const response = makeResponse(200, { 'content-type': 'text/html' }, body);
          const result = await classifyProbeResponse(response, 'example.com', log);
          expect(result).to.deep.equal({ reachable: false, blocked: true, statusCode: 200 });
        });
      });

      it('is case-insensitive for keyword matching', async () => {
        const response = makeResponse(200, { 'content-type': 'text/html' }, 'CF-CHL-WIDGET visible');
        const result = await classifyProbeResponse(response, 'example.com', log);
        expect(result).to.deep.equal({ reachable: false, blocked: true, statusCode: 200 });
      });
    });

    describe('false positive prevention — real content must not trigger soft block', () => {
      [
        ['reCAPTCHA script tag', '<script src="recaptcha/api.js">'],
        ['legitimate captcha link text', 'Complete the CAPTCHA to prove you are human'],
        ['marketing copy with challenge', 'This challenge will test your creativity'],
        ['access denied in content', '<p>Access denied to premium content without subscription</p>'],
        ['JSON non-HTML response', '{"status":"ok"}'],
        ['plain text non-HTML', 'Hello world'],
      ].forEach(([label, body]) => {
        it(`passes clean: ${label}`, async () => {
          const response = makeResponse(200, { 'content-type': 'text/html' }, body);
          const result = await classifyProbeResponse(response, 'example.com', log);
          expect(result).to.deep.equal({ reachable: true, blocked: false, statusCode: 200 });
        });
      });

      it('skips body scan for non-HTML content types', async () => {
        const response = makeResponse(200, { 'content-type': 'application/json' }, 'cf-chl-widget');
        const result = await classifyProbeResponse(response, 'example.com', log);
        expect(result).to.deep.equal({ reachable: true, blocked: false, statusCode: 200 });
      });

      it('skips body scan when content-type header is absent', async () => {
        const response = makeResponse(200, {}, 'cf-chl-widget');
        const result = await classifyProbeResponse(response, 'example.com', log);
        expect(result).to.deep.equal({ reachable: true, blocked: false, statusCode: 200 });
      });
    });

    describe('clean pass', () => {
      [200, 201, 204].forEach((code) => {
        it(`classifies HTTP ${code} clean HTML as reachable`, async () => {
          const response = makeResponse(code, { 'content-type': 'text/html' }, '<h1>Welcome</h1>');
          const result = await classifyProbeResponse(response, 'example.com', log);
          expect(result).to.deep.equal({ reachable: true, blocked: false, statusCode: code });
        });
      });
    });

    describe('unexpected / redirect status codes', () => {
      [301, 302, 307].forEach((code) => {
        it(`classifies HTTP ${code} as not reachable, not blocked`, async () => {
          const result = await classifyProbeResponse(makeResponse(code), 'example.com', log);
          expect(result).to.deep.equal({ reachable: false, blocked: false, statusCode: code });
        });
      });
    });

    describe('logging', () => {
      it('logs hard block with status code', async () => {
        await classifyProbeResponse(makeResponse(403), 'example.com', log);
        expect(log.info.calledWithMatch('[edge-optimize-probe] Hard block for example.com: HTTP 403')).to.be.true;
      });

      it('logs Cloudflare challenge with header info', async () => {
        await classifyProbeResponse(makeResponse(200, { 'cf-mitigated': 'challenge' }), 'example.com', log);
        expect(log.info.calledWithMatch('cf-mitigated: challenge')).to.be.true;
      });

      it('logs soft block with status code', async () => {
        const response = makeResponse(200, { 'content-type': 'text/html' }, 'cf-chl-widget');
        await classifyProbeResponse(response, 'example.com', log);
        expect(log.info.calledWithMatch('[edge-optimize-probe] Soft block')).to.be.true;
      });

      it('logs clean pass with status code', async () => {
        const response = makeResponse(200, { 'content-type': 'text/html' }, '<h1>OK</h1>');
        await classifyProbeResponse(response, 'example.com', log);
        expect(log.info.calledWithMatch('[edge-optimize-probe] Clean pass for example.com: HTTP 200')).to.be.true;
      });

      it('logs unexpected status', async () => {
        await classifyProbeResponse(makeResponse(302), 'example.com', log);
        expect(log.info.calledWithMatch('[edge-optimize-probe] Unexpected status for example.com: HTTP 302')).to.be.true;
      });
    });
  });
});
