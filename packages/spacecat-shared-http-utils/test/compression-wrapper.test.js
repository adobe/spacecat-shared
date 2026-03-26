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
/* eslint-env mocha */
import { expect } from 'chai';
import { gunzip, brotliDecompress, inflate } from 'zlib';
import { promisify } from 'util';

import {
  negotiateEncoding, isCompressible, mergeVary, compress,
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
});
