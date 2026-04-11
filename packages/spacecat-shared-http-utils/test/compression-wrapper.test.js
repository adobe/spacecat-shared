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
import { gunzip, brotliDecompress, inflate } from 'zlib';
import { promisify } from 'util';
import sinon from 'sinon';
import { Response } from '@adobe/fetch';

import {
  negotiateEncoding, isCompressible, mergeVary, compress, compressResponse,
} from '../src/compression-wrapper.js';

const gunzipAsync = promisify(gunzip);
const brotliDecompressAsync = promisify(brotliDecompress);
const inflateAsync = promisify(inflate);

describe('compression-wrapper', () => {
  describe('negotiateEncoding', () => {
    it('returns identity when header is missing', () => {
      expect(negotiateEncoding(null)).to.equal('identity');
      expect(negotiateEncoding(undefined)).to.equal('identity');
      expect(negotiateEncoding('')).to.equal('identity');
    });

    it('returns preferred encoding when all are accepted equally', () => {
      expect(negotiateEncoding('gzip, br, deflate')).to.equal('br');
    });

    it('respects quality values', () => {
      expect(negotiateEncoding('gzip;q=1.0, br;q=0.5')).to.equal('gzip');
    });

    it('returns identity when only identity is accepted', () => {
      expect(negotiateEncoding('identity')).to.equal('identity');
    });

    it('returns identity when all encodings have q=0', () => {
      expect(negotiateEncoding('gzip;q=0, br;q=0')).to.equal('identity');
    });

    it('expands wildcard to first available preference', () => {
      expect(negotiateEncoding('*')).to.equal('br');
    });

    it('expands wildcard excluding explicitly listed encodings', () => {
      expect(negotiateEncoding('gzip;q=0.5, *')).to.equal('br');
    });

    it('returns identity when wildcard has q=0 and no other match', () => {
      expect(negotiateEncoding('*;q=0')).to.equal('identity');
    });

    it('handles single encoding', () => {
      expect(negotiateEncoding('gzip')).to.equal('gzip');
      expect(negotiateEncoding('br')).to.equal('br');
      expect(negotiateEncoding('deflate')).to.equal('deflate');
    });

    it('ignores unsupported encodings', () => {
      expect(negotiateEncoding('compress, sdch')).to.equal('identity');
    });

    it('picks supported encoding among mixed', () => {
      expect(negotiateEncoding('compress, gzip;q=0.8')).to.equal('gzip');
    });

    it('respects custom preference order', () => {
      expect(negotiateEncoding('gzip, br, deflate', ['gzip', 'deflate', 'br'])).to.equal('gzip');
    });

    it('handles whitespace variations', () => {
      expect(negotiateEncoding('  gzip ; q=0.8 , br ; q=1.0 ')).to.equal('br');
    });

    it('treats malformed quality as 1.0', () => {
      expect(negotiateEncoding('gzip;q=abc')).to.equal('gzip');
    });

    it('respects explicit identity preference over compression', () => {
      expect(negotiateEncoding('identity;q=1, gzip;q=0.5')).to.equal('identity');
    });
  });

  describe('isCompressible', () => {
    it('returns true for application/json', () => {
      expect(isCompressible('application/json')).to.be.true;
      expect(isCompressible('application/json; charset=utf-8')).to.be.true;
    });

    it('returns true for text/* types', () => {
      expect(isCompressible('text/html')).to.be.true;
      expect(isCompressible('text/plain')).to.be.true;
      expect(isCompressible('text/csv')).to.be.true;
    });

    it('returns true for application/xml', () => {
      expect(isCompressible('application/xml')).to.be.true;
    });

    it('returns true for +json and +xml suffixed types', () => {
      expect(isCompressible('application/vnd.api+json')).to.be.true;
      expect(isCompressible('application/atom+xml')).to.be.true;
    });

    it('returns false for binary types', () => {
      expect(isCompressible('image/png')).to.be.false;
      expect(isCompressible('application/octet-stream')).to.be.false;
      expect(isCompressible('application/pdf')).to.be.false;
    });

    it('returns false for null/undefined', () => {
      expect(isCompressible(null)).to.be.false;
      expect(isCompressible(undefined)).to.be.false;
    });
  });

  describe('mergeVary', () => {
    it('returns Accept-Encoding when no existing Vary', () => {
      expect(mergeVary(null)).to.equal('Accept-Encoding');
      expect(mergeVary(undefined)).to.equal('Accept-Encoding');
    });

    it('preserves existing Vary and appends Accept-Encoding', () => {
      expect(mergeVary('Origin')).to.equal('Origin, Accept-Encoding');
    });

    it('does not duplicate Accept-Encoding', () => {
      expect(mergeVary('Accept-Encoding')).to.equal('Accept-Encoding');
      expect(mergeVary('Origin, Accept-Encoding')).to.equal('Origin, Accept-Encoding');
    });

    it('handles case-insensitive match', () => {
      expect(mergeVary('accept-encoding')).to.equal('accept-encoding');
    });

    it('does not false-match substring of Accept-Encoding', () => {
      expect(mergeVary('X-Not-Accept-Encoding')).to.equal('X-Not-Accept-Encoding, Accept-Encoding');
    });

    it('returns * unchanged when Vary is wildcard', () => {
      expect(mergeVary('*')).to.equal('*');
    });
  });

  describe('compress', () => {
    const input = Buffer.from('hello world - test compression content');

    it('compresses with brotli and produces decompressible output', async () => {
      const compressed = await compress('br', input);
      const decompressed = await brotliDecompressAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('compresses with gzip and produces decompressible output', async () => {
      const compressed = await compress('gzip', input);
      const decompressed = await gunzipAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('compresses with deflate and produces decompressible output', async () => {
      const compressed = await compress('deflate', input);
      const decompressed = await inflateAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('throws for unsupported encoding', async () => {
      try {
        await compress('compress', input);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Unsupported encoding: compress');
      }
    });
  });

  describe('compressResponse', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = { log: { debug: sinon.stub(), info: sinon.stub(), error: sinon.stub() } };
    });

    afterEach(() => {
      sinon.restore();
    });

    function createMockRequest(acceptEncoding) {
      return {
        headers: {
          get: (key) => (key === 'accept-encoding' ? acceptEncoding : null),
        },
      };
    }

    function createJsonResponse(body, status = 200, extraHeaders = {}) {
      const jsonBody = JSON.stringify(body);
      return new Response(jsonBody, {
        status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...extraHeaders,
        },
      });
    }

    // Generate a body larger than default minSize (1024 bytes)
    function largeBody() {
      const items = [];
      for (let i = 0; i < 50; i += 1) {
        items.push({ id: i, name: `site-${i}.example.com`, status: 'active' });
      }
      return items;
    }

    it('passes through when status is 204', async () => {
      const innerResponse = new Response('', { status: 204 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when status is 304', async () => {
      const innerResponse = new Response('', { status: 304 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Content-Encoding is already set', async () => {
      const innerResponse = createJsonResponse({ data: 'test' }, 200, { 'content-encoding': 'br' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when content-type is not compressible', async () => {
      const innerResponse = new Response(Buffer.from('binary'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Accept-Encoding is missing', async () => {
      const innerResponse = createJsonResponse({ data: 'test' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest(null), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Accept-Encoding resolves to identity', async () => {
      const innerResponse = createJsonResponse({ data: 'test' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('identity'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when body is empty', async () => {
      const innerResponse = new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.status).to.equal(200);
      expect(await result.text()).to.equal('');
    });

    it('passes through when body is below minSize', async () => {
      const smallBody = JSON.stringify({ a: 1 });
      const innerResponse = new Response(smallBody, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { minSize: 1024 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.status).to.equal(200);
      expect(await result.text()).to.equal(smallBody);
      expect(result.headers.get('content-encoding')).to.be.null;
    });

    it('calls the inner handler with request and context', async () => {
      const innerResponse = new Response('', { status: 204 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);
      const req = createMockRequest('gzip');

      await wrapped(req, mockContext);
      expect(handler.calledOnceWith(req, mockContext)).to.be.true;
    });

    it('compresses with brotli when br is preferred', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip, br'), mockContext);

      expect(result.status).to.equal(200);
      expect(result.headers.get('content-encoding')).to.equal('br');
      expect(result.headers.get('vary')).to.include('Accept-Encoding');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await brotliDecompressAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('compresses with gzip when only gzip is accepted', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);

      expect(result.headers.get('content-encoding')).to.equal('gzip');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await gunzipAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('compresses with deflate when only deflate is accepted', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('deflate'), mockContext);

      expect(result.headers.get('content-encoding')).to.equal('deflate');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await inflateAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('preserves response status code', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 201);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.status).to.equal(201);
    });

    it('preserves existing response headers', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { 'x-custom': 'value' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('x-custom')).to.equal('value');
    });

    it('merges Vary header without duplicating', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { vary: 'Origin' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('vary')).to.equal('Origin, Accept-Encoding');
    });

    it('strips content-length from compressed response', async () => {
      const body = largeBody();
      const jsonStr = JSON.stringify(body);
      const innerResponse = new Response(jsonStr, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': String(jsonStr.length),
        },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('content-length')).to.be.null;
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('logs compression stats', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      await wrapped(createMockRequest('gzip'), mockContext);
      expect(mockContext.log.debug.calledOnce).to.be.true;
      expect(mockContext.log.debug.firstCall.args[0]).to.match(/\[compression\]/);
    });

    it('respects custom minSize option', async () => {
      const body = { small: true };
      const jsonStr = JSON.stringify(body);
      const innerResponse = new Response(jsonStr, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { minSize: 1 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('respects custom preference order', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { preference: ['gzip', 'br', 'deflate'] });

      const result = await wrapped(createMockRequest('gzip, br'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('compresses text/html content', async () => {
      const htmlBody = `<html>${'<p>content</p>'.repeat(100)}</html>`;
      const innerResponse = new Response(htmlBody, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { minSize: 1 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await gunzipAsync(compressed);
      expect(decompressed.toString()).to.equal(htmlBody);
    });

    it('uses console as fallback when context has no log', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);
      const consoleStub = sinon.stub(console, 'debug');

      await wrapped(createMockRequest('gzip'), {});

      expect(consoleStub.calledOnce).to.be.true;
      consoleStub.restore();
    });

    it('handles null context gracefully', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), null);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('handles undefined context gracefully', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), undefined);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('preserves multiple Set-Cookie headers', async () => {
      const body = largeBody();
      const jsonBody = JSON.stringify(body);
      const innerResponse = new Response(jsonBody, {
        status: 200,
        headers: [
          ['content-type', 'application/json; charset=utf-8'],
          ['set-cookie', 'a=1; Path=/'],
          ['set-cookie', 'b=2; Path=/'],
        ],
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      const cookies = result.headers.raw()['set-cookie'];
      expect(cookies).to.have.lengthOf(2);
      expect(cookies[0]).to.equal('a=1; Path=/');
      expect(cookies[1]).to.equal('b=2; Path=/');
    });

    it('falls back to uncompressed on compression error', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);

      // Temporarily make compress throw by passing invalid encoding via custom preference
      const errorWrapped = compressResponse(handler, { preference: ['invalid-encoding'] });
      const logStub = { info: sinon.stub(), error: sinon.stub() };
      const result = await errorWrapped(createMockRequest('invalid-encoding'), { log: logStub });

      // Should fall back to uncompressed
      expect(result.headers.get('content-encoding')).to.be.null;
      expect(logStub.error.calledOnce).to.be.true;
      const resultBody = await result.text();
      expect(JSON.parse(resultBody)).to.deep.equal(body);
    });

    it('passes through when status is 206 Partial Content', async () => {
      const innerResponse = new Response('partial', {
        status: 206,
        headers: { 'content-type': 'application/json; charset=utf-8', 'content-range': 'bytes 0-99/200' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Content-Range header is present', async () => {
      const innerResponse = new Response('partial', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'content-range': 'bytes 0-99/200' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Cache-Control includes no-transform', async () => {
      const innerResponse = createJsonResponse({ data: 'test' }, 200, { 'cache-control': 'no-transform' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('weakens strong ETag on compressed response', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { etag: '"abc123"' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('etag')).to.equal('W/"abc123"');
    });

    it('preserves weak ETag unchanged on compressed response', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { etag: 'W/"abc123"' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('etag')).to.equal('W/"abc123"');
    });
  });
});
