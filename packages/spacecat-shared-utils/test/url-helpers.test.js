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
import sinon from 'sinon';
import {
  canonicalizeUrl,
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
  hasNonWWWSubdomain,
  toggleWWWHostname,
  wwwUrlResolver,
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

    it('should handle timeout errors for HEAD requests and retry with GET', async () => {
      // Simulate a timeout error for HEAD request
      // The function should catch the error and retry with GET
      nock('https://example.com')
        .head('/')
        .replyWithError('Timeout error');

      nock('https://example.com')
        .get('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com');
      expect(result).to.equal('https://example.com/');
    });

    it('should use 10s timeout for HEAD requests', async () => {
      // Verify HEAD request completes within timeout
      nock('https://example.com')
        .head('/')
        .reply(200);

      const startTime = Date.now();
      const result = await resolveCanonicalUrl('https://example.com', 'HEAD');
      const duration = Date.now() - startTime;

      expect(result).to.equal('https://example.com/');
      expect(duration).to.be.below(11000); // Should complete well before timeout
    });

    it('should use 20s timeout for GET requests', async () => {
      // Verify GET request completes within timeout
      nock('https://example.com')
        .get('/')
        .reply(200);

      const startTime = Date.now();
      const result = await resolveCanonicalUrl('https://example.com', 'GET');
      const duration = Date.now() - startTime;

      expect(result).to.equal('https://example.com/');
      expect(duration).to.be.below(21000); // Should complete well before timeout
    });

    it('should handle AbortError from timeout and retry with GET for HEAD', async () => {
      // Simulate AbortError from timeout
      nock('https://example.com')
        .head('/')
        .replyWithError('The operation was aborted');

      nock('https://example.com')
        .get('/')
        .reply(200);

      const result = await resolveCanonicalUrl('https://example.com', 'HEAD');
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
  });

  describe('hasNonWWWSubdomain', () => {
    it('should return true for URLs with non-www subdomains', () => {
      expect(hasNonWWWSubdomain('https://subdomain.domain.com')).to.equal(true);
      expect(hasNonWWWSubdomain('https://blog.example.com')).to.equal(true);
      expect(hasNonWWWSubdomain('https://sub.domain.museum')).to.equal(true);
      expect(hasNonWWWSubdomain('https://sub.domain.com/path?query=123')).to.equal(true);
    });

    it('should return false for URLs without subdomains or with www subdomain', () => {
      expect(hasNonWWWSubdomain('https://www.example.com/path/')).to.equal(false);
      expect(hasNonWWWSubdomain('https://www.site.com')).to.equal(false);
      expect(hasNonWWWSubdomain('https://domain.com')).to.equal(false);
      expect(hasNonWWWSubdomain('https://example.co.uk')).to.equal(false);
      expect(hasNonWWWSubdomain('https://example.com.tr')).to.equal(false);
    });

    it('should handle URLs without scheme', () => {
      // URI library may parse URLs without scheme differently
      // 'blog.example.com' without scheme might be treated as a path, not hostname
      expect(hasNonWWWSubdomain('blog.example.com')).to.equal(false);
      expect(hasNonWWWSubdomain('www.example.com')).to.equal(false);
      expect(hasNonWWWSubdomain('example.com')).to.equal(false);
    });

    it('should throw error for invalid URLs', () => {
      // Test with various invalid inputs that might cause URI to throw
      expect(() => hasNonWWWSubdomain(null)).to.throw('Cannot parse baseURL');
    });

    it('should handle complex TLDs correctly', () => {
      expect(hasNonWWWSubdomain('https://blog.example.co.uk')).to.equal(true);
      expect(hasNonWWWSubdomain('https://www.example.co.uk')).to.equal(false);
      expect(hasNonWWWSubdomain('https://example.co.uk')).to.equal(false);
    });
  });

  describe('toggleWWWHostname', () => {
    it('should add www to non-www hostname', () => {
      expect(toggleWWWHostname('example.com')).to.equal('www.example.com');
      expect(toggleWWWHostname('domain.org')).to.equal('www.domain.org');
    });

    it('should remove www from www hostname', () => {
      expect(toggleWWWHostname('www.example.com')).to.equal('example.com');
      expect(toggleWWWHostname('www.domain.org')).to.equal('domain.org');
    });

    it('should not toggle hostnames with non-www subdomains', () => {
      expect(toggleWWWHostname('blog.example.com')).to.equal('blog.example.com');
      expect(toggleWWWHostname('subdomain.domain.org')).to.equal('subdomain.domain.org');
    });
  });

  describe('wwwUrlResolver', () => {
    let sandbox;
    let log;
    let site;
    let rumApiClient;

    beforeEach(() => {
      sandbox = sinon.createSandbox();

      rumApiClient = {
        retrieveDomainkey: sandbox.stub(),
      };

      log = {
        debug: sandbox.stub(),
        error: sandbox.stub(),
      };

      site = {
        getBaseURL: sandbox.stub(),
        getConfig: sandbox.stub().returns({
          getFetchConfig: sandbox.stub().returns({}),
        }),
      };
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should return overrideBaseURL when configured with https', async () => {
      site.getConfig.returns({
        getFetchConfig: () => ({
          overrideBaseURL: 'https://override.example.com',
        }),
      });

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('override.example.com');
      expect(rumApiClient.retrieveDomainkey).not.to.have.been.called;
    });

    it('should return overrideBaseURL when configured with http', async () => {
      site.getConfig.returns({
        getFetchConfig: () => ({
          overrideBaseURL: 'http://override.example.com',
        }),
      });

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('override.example.com');
      expect(rumApiClient.retrieveDomainkey).not.to.have.been.called;
    });

    it('should not use overrideBaseURL when it does not have http/https scheme', async () => {
      site.getConfig.returns({
        getFetchConfig: () => ({
          overrideBaseURL: 'override.example.com',
        }),
      });
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.called;
    });

    it('should return hostname directly for non-www subdomains', async () => {
      site.getBaseURL.returns('https://blog.example.com');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('blog.example.com');
      expect(log.debug).to.have.been.calledWith('Resolved URL blog.example.com since https://blog.example.com contains subdomain');
      expect(rumApiClient.retrieveDomainkey).not.to.have.been.called;
    });

    it('should check RUM for www subdomain (not return early)', async () => {
      site.getBaseURL.returns('https://www.example.com');
      rumApiClient.retrieveDomainkey.withArgs('example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('example.com');
    });

    it('should check RUM for no subdomain (not return early)', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('www.example.com');
    });

    it('should prioritize www-toggled version (www added) when it has RUM data', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('www.example.com');
      expect(log.debug).to.have.been.calledWith('Resolved URL www.example.com for https://example.com using RUM API Client');
    });

    it('should prioritize www-toggled version (www removed) when it has RUM data', async () => {
      site.getBaseURL.returns('https://www.example.com');
      rumApiClient.retrieveDomainkey.withArgs('example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('example.com');
      expect(log.debug).to.have.been.calledWith('Resolved URL example.com for https://www.example.com using RUM API Client');
    });

    it('should fall back to original hostname when www-toggled has no RUM data', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').rejects(new Error('No domain key'));
      rumApiClient.retrieveDomainkey.withArgs('example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('www.example.com');
      expect(rumApiClient.retrieveDomainkey).to.have.been.calledWith('example.com');
      expect(log.debug).to.have.been.calledWith('Resolved URL example.com for https://example.com using RUM API Client');
    });

    it('should fall back to www version when both RUM checks fail', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.rejects(new Error('No domain key'));

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
      expect(log.debug).to.have.been.calledWith('Fallback to www.example.com for URL resolution for https://example.com');
      expect(log.error).to.have.been.calledTwice;
    });

    it('should fall back to www version for www hostname when both RUM checks fail', async () => {
      site.getBaseURL.returns('https://www.example.com');
      rumApiClient.retrieveDomainkey.rejects(new Error('No domain key'));

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
      expect(log.debug).to.have.been.calledWith('Fallback to www.example.com for URL resolution for https://www.example.com');
    });

    it('should log errors for both failed RUM attempts', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.rejects(new Error('API error'));

      await wwwUrlResolver(site, rumApiClient, log);

      expect(log.error).to.have.been.calledWith('Could not retrieved RUM domainkey for example.com: API error');
      expect(log.error).to.have.been.calledTwice;
    });

    it('should handle different error messages in first and second RUM attempts', async () => {
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').rejects(new Error('First error'));
      rumApiClient.retrieveDomainkey.withArgs('example.com').rejects(new Error('Second error'));

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(log.error).to.have.been.calledWith('Could not retrieved RUM domainkey for example.com: First error');
      expect(log.error).to.have.been.calledWith('Could not retrieved RUM domainkey for example.com: Second error');
      expect(result).to.equal('www.example.com');
    });

    it('should fallback to non-www when hostname already has www and both RUM checks fail', async () => {
      site.getBaseURL.returns('https://www.example.org');
      rumApiClient.retrieveDomainkey.rejects(new Error('No domain key'));

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.org');
      expect(log.debug).to.have.been.calledWith('Fallback to www.example.org for URL resolution for https://www.example.org');
    });

    it('should handle getFetchConfig returning null', async () => {
      site.getConfig.returns({
        getFetchConfig: () => null,
      });
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
    });

    it('should handle getConfig returning null', async () => {
      site.getConfig.returns(null);
      site.getBaseURL.returns('https://example.com');
      rumApiClient.retrieveDomainkey.withArgs('www.example.com').resolves('domain-key');

      const result = await wwwUrlResolver(site, rumApiClient, log);

      expect(result).to.equal('www.example.com');
    });
  });

  describe('canonicalizeUrl', () => {
    it('removes protocol and converts to lowercase', () => {
      expect(canonicalizeUrl('HTTPS://Example.com/Page')).to.equal('example.com/page');
      expect(canonicalizeUrl('http://EXAMPLE.COM/Path')).to.equal('example.com/path');
    });

    it('removes www prefixes', () => {
      expect(canonicalizeUrl('https://www.example.com/path')).to.equal('example.com/path');
      expect(canonicalizeUrl('https://www2.example.com/path')).to.equal('example.com/path');
      expect(canonicalizeUrl('https://www123.example.com/path')).to.equal('example.com/path');
    });

    it('removes trailing slashes', () => {
      expect(canonicalizeUrl('https://example.com/path/')).to.equal('example.com/path');
      expect(canonicalizeUrl('https://example.com/')).to.equal('example.com');
      expect(canonicalizeUrl('https://example.com/path/subpath/')).to.equal('example.com/path/subpath');
    });

    it('handles combined variations', () => {
      expect(canonicalizeUrl('HTTPS://WWW.Example.COM/Path/')).to.equal('example.com/path');
      expect(canonicalizeUrl('http://www2.EXAMPLE.com/PAGE/SubPage/')).to.equal('example.com/page/subpage');
    });

    it('strips query parameters when stripQuery is true', () => {
      expect(canonicalizeUrl('https://example.com/path?param=value', { stripQuery: true }))
        .to.equal('example.com/path');
      expect(canonicalizeUrl('https://example.com/path#anchor', { stripQuery: true }))
        .to.equal('example.com/path');
      expect(canonicalizeUrl('https://example.com/path?a=b&c=d#hash', { stripQuery: true }))
        .to.equal('example.com/path');
      expect(canonicalizeUrl('https://www2.google.com/?query=hello&params=world', { stripQuery: true }))
        .to.equal('google.com');
      expect(canonicalizeUrl('https://example.com/?param=value', { stripQuery: true }))
        .to.equal('example.com');
    });

    it('preserves query parameters by default', () => {
      expect(canonicalizeUrl('https://example.com/path?param=value'))
        .to.equal('example.com/path?param=value');
      expect(canonicalizeUrl('https://example.com/path#anchor'))
        .to.equal('example.com/path#anchor');
    });

    it('handles empty and invalid inputs', () => {
      expect(canonicalizeUrl('')).to.equal('');
      expect(canonicalizeUrl(null)).to.equal('');
      expect(canonicalizeUrl(undefined)).to.equal('');
      expect(canonicalizeUrl(123)).to.equal('');
    });

    it('trims whitespace', () => {
      expect(canonicalizeUrl('  https://example.com/path  ')).to.equal('example.com/path');
      expect(canonicalizeUrl('\t\nhttps://example.com/path\n\t')).to.equal('example.com/path');
    });

    it('handles URLs without protocol', () => {
      expect(canonicalizeUrl('example.com/path')).to.equal('example.com/path');
      expect(canonicalizeUrl('www.example.com/path')).to.equal('example.com/path');
    });
  });
});
