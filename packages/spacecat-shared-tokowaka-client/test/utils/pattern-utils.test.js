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
import { buildUrlMatcher } from '../../src/utils/pattern-utils.js';

describe('pattern-utils', () => {
  describe('buildUrlMatcher', () => {
    describe('invalid inputs', () => {
      it('returns null for null', () => {
        expect(buildUrlMatcher(null)).to.be.null;
      });

      it('returns null for undefined', () => {
        expect(buildUrlMatcher(undefined)).to.be.null;
      });

      it('returns null for a number', () => {
        expect(buildUrlMatcher(42)).to.be.null;
      });

      it('returns null for an empty string', () => {
        expect(buildUrlMatcher('')).to.be.null;
      });
    });

    describe('/* — domain-wide pattern', () => {
      let match;
      beforeEach(() => {
        match = buildUrlMatcher('/*');
      });

      it('matches the root path', () => {
        expect(match('https://example.com/')).to.be.true;
      });

      it('matches any sub-path', () => {
        expect(match('https://example.com/products/item')).to.be.true;
        expect(match('https://example.com/a/b/c')).to.be.true;
      });

      it('returns false for an invalid URL', () => {
        expect(match('not-a-url')).to.be.false;
      });
    });

    describe('/path/* — prefix patterns', () => {
      let match;
      beforeEach(() => {
        match = buildUrlMatcher('/products/*');
      });

      it('matches a direct child path', () => {
        expect(match('https://example.com/products/item')).to.be.true;
      });

      it('matches a nested child path', () => {
        expect(match('https://example.com/products/sub/item')).to.be.true;
      });

      it('matches the exact prefix path without a trailing slash', () => {
        expect(match('https://example.com/products')).to.be.true;
      });

      it('matches the exact prefix path with a trailing slash', () => {
        expect(match('https://example.com/products/')).to.be.true;
      });

      it('does not over-match adjacent path segments (boundary safety)', () => {
        expect(match('https://example.com/productsabc')).to.be.false;
        expect(match('https://example.com/products-new')).to.be.false;
      });

      it('does not match an unrelated path', () => {
        expect(match('https://example.com/blog/post')).to.be.false;
      });

      it('returns false for an invalid URL', () => {
        expect(match('not-a-url')).to.be.false;
      });
    });

    describe('regex patterns', () => {
      it('matches against the full URL string (not pathname only) for backward compatibility', () => {
        // Regex patterns are tested against the full URL (e.g. 'https://example.com/page').
        // A pathname-only regex like '^/blog' will never match because the URL string starts with
        // a scheme. Use the '/*' suffix form for pathname-only prefix matching.
        const fullUrlMatch = buildUrlMatcher('^https://example\\.com/blog');
        expect(fullUrlMatch('https://example.com/blog/post')).to.be.true;
        expect(fullUrlMatch('https://example.com/news/post')).to.be.false;
      });

      it('matches a full-URL regex with wildcard', () => {
        const match = buildUrlMatcher('^https://example\\.com/.*');
        expect(match('https://example.com/products/item')).to.be.true;
        expect(match('https://other.com/products/item')).to.be.false;
      });

      it('matches a simple substring against the full URL', () => {
        const match = buildUrlMatcher('/products');
        expect(match('https://example.com/products/item')).to.be.true;
        expect(match('https://example.com/blog')).to.be.false;
      });

      it('returns null for an invalid regex pattern', () => {
        expect(buildUrlMatcher('[invalid')).to.be.null;
      });
    });
  });
});
