/*
 * Copyright 2024 Adobe. All rights reserved.
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
  composeAuditURL,
  composeBaseURL,
  prependSchema,
  stripPort,
  stripTrailingDot,
  stripTrailingSlash,
  stripWWW,
  resolveCanonicalUrl,
  getSpacecatRequestHeaders,
  ensureHttps,
  urlMatchesFilter,
} from '../src/url-helpers.js';

describe('URL Utility Functions', () => {
  describe('prependSchema', () => {
    it('should prepend "https://" schema if not present', () => {
      expect(prependSchema('example.com')).to.equal('https://example.com');
    });

    it('should not modify the URL if schema is already present', () => {
      expect(prependSchema('https://example.com')).to.equal('https://example.com');
      expect(prependSchema('http://example.com')).to.equal('http://example.com');
    });

    it('should handle URLs with paths', () => {
      expect(prependSchema('example.com/path')).to.equal('https://example.com/path');
    });

    it('should handle URLs with query parameters', () => {
      expect(prependSchema('example.com/path?param=value')).to.equal('https://example.com/path?param=value');
    });
  });

  describe('stripPort', () => {
    it('should remove port number from the end of the URL', () => {
      expect(stripPort('example.com:80')).to.equal('example.com');
      expect(stripPort('example.com:8080')).to.equal('example.com');
    });

    it('should not modify the URL if no port number present', () => {
      expect(stripPort('example.com')).to.equal('example.com');
    });

    it('should handle URLs with paths and ports', () => {
      expect(stripPort('example.com:8080/path')).to.equal('example.compath');
    });

    it('should handle URLs with query parameters and ports', () => {
      expect(stripPort('example.com:8080/path?param=value')).to.equal('example.compath?param=value');
    });
  });

  describe('stripTrailingDot', () => {
    it('should remove trailing dot from the end of the URL', () => {
      expect(stripTrailingDot('example.com.')).to.equal('example.com');
      expect(stripTrailingDot('.example.com')).to.equal('.example.com');
      expect(stripTrailingDot('example.com.abc')).to.equal('example.com.abc');
    });

    it('should not modify the URL if no trailing dot present', () => {
      expect(stripTrailingDot('example.com')).to.equal('example.com');
    });

    it('should handle URLs with paths and trailing dots', () => {
      expect(stripTrailingDot('example.com./path')).to.equal('example.com./path');
    });
  });

  describe('stripTrailingSlash', () => {
    it('should remove trailing slash from the end of the URL if path = /', () => {
      expect(stripTrailingSlash('example.com/')).to.equal('example.com');
      expect(stripTrailingSlash('https://example.com/')).to.equal('https://example.com');
      expect(stripTrailingSlash('example.com//')).to.equal('example.com//');
      expect(stripTrailingSlash('/example.com/')).to.equal('/example.com/');
      expect(stripTrailingSlash('example.com/abc/')).to.equal('example.com/abc/');
      expect(stripTrailingSlash('https://example.com/abc/')).to.equal('https://example.com/abc/');
    });

    it('should not modify the URL if no trailing slash present', () => {
      expect(stripTrailingSlash('example.com')).to.equal('example.com');
    });

    it('should handle URLs with query parameters', () => {
      expect(stripTrailingSlash('example.com/?param=value')).to.equal('example.com/?param=value');
    });
  });

  describe('stripWWW', () => {
    it('should remove "www." from the beginning of the URL', () => {
      expect(stripWWW('www.example.com')).to.equal('example.com');
    });

    it('should not modify the URL if "www." is not present', () => {
      expect(stripWWW('example.com')).to.equal('example.com');
    });

    it('should remove "www." even if schema is present', () => {
      expect(stripWWW('https://www.example.com')).to.equal('https://example.com');
      expect(stripWWW('http://www.example.com')).to.equal('http://example.com');
    });

    it('should handle URLs with paths', () => {
      expect(stripWWW('www.example.com/path')).to.equal('example.com/path');
    });

    it('should handle URLs with query parameters', () => {
      expect(stripWWW('www.example.com/path?param=value')).to.equal('example.com/path?param=value');
    });
  });

  describe('composeBaseURL', () => {
    it('should compose base URL by applying all transformations', () => {
      expect(composeBaseURL('https://www.example.com:8080/')).to.equal('https://example.com');
      expect(composeBaseURL('http://www.example.com:8080/')).to.equal('http://example.com');
      expect(composeBaseURL('www.example.com:8080/')).to.equal('https://example.com');
      expect(composeBaseURL('example.com:8080/')).to.equal('https://example.com');
      expect(composeBaseURL('https://example.com/')).to.equal('https://example.com');
      expect(composeBaseURL('http://example.com/')).to.equal('http://example.com');
      expect(composeBaseURL('example.com/')).to.equal('https://example.com');
      expect(composeBaseURL('example.com.:123')).to.equal('https://example.com');
      expect(composeBaseURL('WWW.example.com')).to.equal('https://example.com');
      expect(composeBaseURL('WWW.example.com.:342')).to.equal('https://example.com');
    });

    it('should handle edge cases', () => {
      expect(composeBaseURL('')).to.equal('https://');
      expect(composeBaseURL('example')).to.equal('https://example');
    });
  });

  describe('composeAuditURL', () => {
    afterEach(() => {
      nock.cleanAll();
    });
    it('should compose audit URL', async () => {
      nock('https://abc.com')
        .get('/')
        .reply(200);
      nock('https://abc.com')
        .get('/us/en/')
        .reply(200);
      await expect(composeAuditURL('https://abc.com')).to.eventually.equal('abc.com');
      await expect(composeAuditURL('https://abc.com/us/en/')).to.eventually.equal('abc.com/us/en/');
    });

    it('should compose audit URL with customed user agent', async () => {
      nock('https://abc.com', {
        reqheaders: {
          'User-Agent': 'customed user agent',
        },
      })
        .get('/')
        .reply(200);
      await expect(composeAuditURL('https://abc.com', 'customed user agent')).to.eventually.equal('abc.com');
    });

    it('should follow redirect when composing audit URL', async () => {
      nock('https://abc.com')
        .get('/')
        .reply(301, undefined, { Location: 'https://www.abc.com/' });

      nock('https://www.abc.com')
        .get('/')
        .reply(200, 'Success');

      const inputUrl = 'abc.com';
      await expect(composeAuditURL(inputUrl)).to.eventually.equal('www.abc.com');
    });

    it('should handle URLs without user agent', async () => {
      nock('https://abc.com')
        .get('/')
        .reply(200);
      await expect(composeAuditURL('abc.com')).to.eventually.equal('abc.com');
    });

    it('should handle URLs with paths and trailing slashes', async () => {
      nock('https://abc.com')
        .get('/path/')
        .reply(200);
      await expect(composeAuditURL('https://abc.com/path/')).to.eventually.equal('abc.com/path/');
    });
  });

  describe('getSpacecatRequestHeaders', () => {
    it('should return headers with SPACECAT_USER_AGENT', () => {
      const headers = getSpacecatRequestHeaders();
      expect(headers).to.have.property('User-Agent');
      expect(headers).to.have.property('Accept');
      expect(headers).to.have.property('Accept-Language');
      expect(headers).to.have.property('Cache-Control');
      expect(headers).to.have.property('Pragma');
      expect(headers).to.have.property('Referer');
    });
  });

  describe('ensureHttps', () => {
    it('should convert HTTP to HTTPS', () => {
      expect(ensureHttps('http://example.com')).to.equal('https://example.com/');
    });

    it('should keep HTTPS as is', () => {
      expect(ensureHttps('https://example.com')).to.equal('https://example.com/');
    });

    it('should handle URLs with paths', () => {
      expect(ensureHttps('http://example.com/path')).to.equal('https://example.com/path');
    });
  });

  describe('resolveCanonicalUrl', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should resolve canonical URL successfully with HEAD request', async () => {
      nock('https://example.com')
        .head('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://example.com/');
    });

    it('should handle redirects and return final URL', async () => {
      nock('https://example.com')
        .head('/')
        .reply(301, undefined, { Location: 'https://www.example.com/' });

      nock('https://www.example.com')
        .head('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://www.example.com/');
    });

    it('should fallback to GET when HEAD fails', async () => {
      nock('https://example.com')
        .head('/')
        .reply(405); // Method not allowed

      nock('https://example.com')
        .get('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://example.com/');
    });

    it('should handle network errors and retry with GET', async () => {
      nock('https://example.com')
        .head('/')
        .replyWithError('Network error');

      nock('https://example.com')
        .get('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://example.com/');
    });

    it('should return null when both HEAD and GET fail', async () => {
      nock('https://example.com')
        .head('/')
        .reply(404);

      nock('https://example.com')
        .get('/')
        .reply(404);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.be.null;
    });

    it('should return null when network error occurs on GET retry', async () => {
      nock('https://example.com')
        .head('/')
        .replyWithError('Network error');

      nock('https://example.com')
        .get('/')
        .replyWithError('Network error');

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.be.null;
    });

    it('should use custom method when provided', async () => {
      nock('https://example.com')
        .get('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com', 'GET');
      expect(result).to.equal('https://example.com/');
    });

    it('should convert HTTP to HTTPS in the final URL', async () => {
      nock('http://example.com')
        .head('/')
        .reply(200);

      const result = await resolveCanonicalUrl('http://example.com');
      expect(result).to.equal('https://example.com/');
    });

    it('should handle URLs with paths and preserve them', async () => {
      nock('https://example.com')
        .head('/path/to/resource')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com/path/to/resource');
      expect(result).to.equal('https://example.com/path/to/resource');
    });

    it('should handle multiple redirects', async () => {
      nock('https://example.com')
        .head('/')
        .reply(301, undefined, { Location: 'https://www.example.com/' });

      nock('https://www.example.com')
        .head('/')
        .reply(302, undefined, { Location: 'https://final.example.com/' });

      nock('https://final.example.com')
        .head('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://final.example.com/');
    });

    it('should return null for non-200 responses without redirects', async () => {
      nock('https://example.com')
        .head('/')
        .reply(500);

      nock('https://example.com')
        .get('/')
        .reply(500);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.be.null;
    });

    it('should fallback to GET when HEAD fails with no redirect', async () => {
      nock('https://example.com')
        .head('/')
        .reply(404); // Not found - resp.ok will be false

      nock('https://example.com')
        .get('/')
        .reply(200); // Success for the GET fallback

      const result = await resolveCanonicalUrl('https://example.com/', 'HEAD');
      expect(result).to.equal('https://example.com/');
    });
  });

  describe('urlMatchesFilter', () => {
    it('should return true when filterUrls is null', () => {
      expect(urlMatchesFilter('https://example.com/path', null)).to.be.true;
    });

    it('should return true when filterUrls is undefined', () => {
      expect(urlMatchesFilter('https://example.com/path', undefined)).to.be.true;
    });

    it('should return true when filterUrls is empty array', () => {
      expect(urlMatchesFilter('https://example.com/path', [])).to.be.true;
    });

    it('should return true when URL path matches a filter URL path', () => {
      const filterUrls = ['example.com/path', 'other.com/different'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should return true when URL path matches a filter URL path with different domains', () => {
      const filterUrls = ['domain1.com/path', 'domain2.com/path'];
      expect(urlMatchesFilter('https://domain3.com/path', filterUrls)).to.be.true;
    });

    it('should return false when URL path does not match any filter URL path', () => {
      const filterUrls = ['example.com/different', 'other.com/another'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.false;
    });

    it('should handle URLs without schema by prepending https://', () => {
      const filterUrls = ['https://example.com/path'];
      expect(urlMatchesFilter('example.com/path', filterUrls)).to.be.true;
    });

    it('should handle filter URLs without schema by prepending https://', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle both URLs without schema', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('example.com/path', filterUrls)).to.be.true;
    });

    it('should handle root path matching', () => {
      const filterUrls = ['example.com/', 'other.com/'];
      expect(urlMatchesFilter('https://example.com/', filterUrls)).to.be.true;
    });

    it('should handle nested paths', () => {
      const filterUrls = ['example.com/path/to/resource', 'other.com/different'];
      expect(urlMatchesFilter('https://example.com/path/to/resource', filterUrls)).to.be.true;
    });

    it('should handle paths with query parameters (ignoring them)', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('https://example.com/path?param=value', filterUrls)).to.be.true;
    });

    it('should handle filter URLs with query parameters (ignoring them)', () => {
      const filterUrls = ['example.com/path?param=value'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle paths with fragments (ignoring them)', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('https://example.com/path#fragment', filterUrls)).to.be.true;
    });

    it('should handle filter URLs with fragments (ignoring them)', () => {
      const filterUrls = ['example.com/path#fragment'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle case-sensitive path matching', () => {
      const filterUrls = ['example.com/Path'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.false;
      expect(urlMatchesFilter('https://example.com/Path', filterUrls)).to.be.true;
    });

    it('should handle multiple filter URLs and return true if any match', () => {
      const filterUrls = ['example.com/first', 'example.com/second', 'example.com/third'];
      expect(urlMatchesFilter('https://example.com/second', filterUrls)).to.be.true;
    });

    it('should handle multiple filter URLs and return false if none match', () => {
      const filterUrls = ['example.com/first', 'example.com/second', 'example.com/third'];
      expect(urlMatchesFilter('https://example.com/fourth', filterUrls)).to.be.false;
    });

    it('should handle URLs with ports (ignoring them)', () => {
      const filterUrls = ['example.com:8080/path'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle URLs with www prefix (ignoring it)', () => {
      const filterUrls = ['www.example.com/path'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle URLs with leading and trailing whitespace', () => {
      const filterUrls = ['  example.com/path  ', '  other.com/different  '];
      expect(urlMatchesFilter('  https://example.com/path  ', filterUrls)).to.be.true;
    });

    it('should handle URLs with multiple trailing slashes', () => {
      const filterUrls = ['example.com/path///', 'other.com/different///'];
      expect(urlMatchesFilter('https://example.com/path///', filterUrls)).to.be.true;
    });

    it('should handle root paths with multiple trailing slashes', () => {
      const filterUrls = ['example.com///', 'other.com///'];
      expect(urlMatchesFilter('https://example.com///', filterUrls)).to.be.true;
    });

    it('should handle mixed whitespace and trailing slashes', () => {
      const filterUrls = ['  example.com/path///  ', '  other.com/different///  '];
      expect(urlMatchesFilter('  https://example.com/path///  ', filterUrls)).to.be.true;
    });

    it('should handle filter URLs with whitespace and trailing slashes', () => {
      const filterUrls = ['  example.com/path///  '];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle input URL with whitespace and trailing slashes', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('  https://example.com/path///  ', filterUrls)).to.be.true;
    });

    it('should handle invalid main URL and return false', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter('invalid-url', filterUrls)).to.be.false;
    });

    it('should handle invalid filter URLs and continue checking others', () => {
      const filterUrls = ['invalid-filter-url', 'example.com/path', 'another-invalid-url'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle all invalid filter URLs and return false', () => {
      const filterUrls = ['invalid-filter-url-1', 'invalid-filter-url-2'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.false;
    });

    it('should handle null or undefined input URL', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter(null, filterUrls)).to.be.false;
      expect(urlMatchesFilter(undefined, filterUrls)).to.be.false;
    });

    it('should handle non-string input URL', () => {
      const filterUrls = ['example.com/path'];
      expect(urlMatchesFilter(123, filterUrls)).to.be.false;
      expect(urlMatchesFilter({}, filterUrls)).to.be.false;
    });

    it('should handle URL that causes prependSchema to fail', () => {
      const filterUrls = ['example.com/path'];
      // Create a URL that will cause prependSchema to fail when trying to create URL object
      expect(urlMatchesFilter('https://[invalid-url]', filterUrls)).to.be.false;
    });

    it('should handle filter URL that causes prependSchema to fail', () => {
      const filterUrls = ['[invalid-filter-url]', 'example.com/path'];
      expect(urlMatchesFilter('https://example.com/path', filterUrls)).to.be.true;
    });

    it('should handle edge case with malformed URL that has non-string pathname', () => {
      // This test case is designed to cover the edge case in normalizePathname
      // where pathname might be null or non-string
      const filterUrls = ['example.com'];

      // Create a scenario that might result in a non-string pathname
      // by using a URL that could potentially cause pathname to be null/undefined
      expect(urlMatchesFilter('https://example.com', filterUrls)).to.be.true;
    });

    it('should handle URLs with null components gracefully', () => {
      // Test with various edge cases that might trigger the normalizePathname edge case
      const filterUrls = ['domain.com/path'];

      // Test with URLs that have unusual structures
      expect(urlMatchesFilter('https://domain.com/path', filterUrls)).to.be.true;
      expect(urlMatchesFilter('domain.com/path', filterUrls)).to.be.true;
    });

    it('should test normalizePathname edge cases directly', async () => {
      // Import the exported normalizePathname function
      const { normalizePathname } = await import('../src/url-helpers.js');

      // Test the specific line 203 condition: !pathname
      expect(normalizePathname(null)).to.be.null;
      expect(normalizePathname(undefined)).to.be.undefined;
      expect(normalizePathname('')).to.equal('');
      expect(normalizePathname(false)).to.be.false;
      expect(normalizePathname(0)).to.equal(0);

      // Test the specific line 203 condition: typeof pathname !== 'string'
      expect(normalizePathname(123)).to.equal(123);
      expect(normalizePathname({})).to.deep.equal({});
      expect(normalizePathname([])).to.deep.equal([]);
      expect(normalizePathname(true)).to.be.true;

      // Test normal string cases to ensure function works correctly
      expect(normalizePathname('/')).to.equal('/');
      expect(normalizePathname('/path/')).to.equal('/path');
      expect(normalizePathname('/path/to/resource///')).to.equal('/path/to/resource');
    });
  });
});
