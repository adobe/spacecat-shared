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
  getRequestHeaders,
  ensureHttps,
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

  describe('getRequestHeaders', () => {
    it('should return headers with SPACECAT_USER_AGENT', () => {
      const headers = getRequestHeaders();
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

    it('should throw error when both HEAD and GET fail', async () => {
      nock('https://example.com')
        .head('/')
        .reply(404);

      nock('https://example.com')
        .get('/')
        .reply(404);

      await expect(resolveCanonicalUrl('https://example.com'))
        .to.be.rejectedWith('HTTP error! status: 404');
    });

    it('should throw error when network error occurs on GET retry', async () => {
      nock('https://example.com')
        .head('/')
        .replyWithError('Network error');

      nock('https://example.com')
        .get('/')
        .replyWithError('Network error');

      await expect(resolveCanonicalUrl('https://example.com'))
        .to.be.rejectedWith('Failed to retrieve URL (https://example.com): Network error');
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

    it('should handle non-200 responses without redirects', async () => {
      nock('https://example.com')
        .head('/')
        .reply(500);

      nock('https://example.com')
        .get('/')
        .reply(500);

      await expect(resolveCanonicalUrl('https://example.com'))
        .to.be.rejectedWith('HTTP error! status: 500');
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
});
