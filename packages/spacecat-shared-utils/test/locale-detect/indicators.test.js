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
import * as cheerio from 'cheerio';

import {
  checkTld,
  checkSubdomain,
  checkPath,
  checkHeaders,
  checkHtmlLang,
  checkMetaTags,
  checkHrefLang,
  checkContentLanguage,
} from '../../src/locale-detect/indicators.js';

describe('Language Detection Indicators', () => {
  describe('checkTld', () => {
    it('returns an empty array if the tld is not found', () => {
      const result = checkTld({ baseUrl: new URL('https://example') });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if the tld does not match any country', () => {
      const result = checkTld({ baseUrl: new URL('https://example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns a region if the tld matches a country', () => {
      const result = checkTld({ baseUrl: new URL('https://www.example.fr') });
      expect(result).to.deep.equal([{ region: 'FR', type: 'tld' }]);
    });
  });

  describe('checkSubdomain', () => {
    it('returns an empty array if the hostname does not have a subdomain', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if the subdomain is www', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://www.example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if the subdomain is not a locale', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://blog.example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns a language and region if the subdomain is a valid language and region', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://de.example.com') });
      expect(result).to.deep.equal([{ language: 'de', region: 'DE', type: 'subdomain' }]);
    });

    it('returns an empty array if the subdomain is neither a valid language nor a valid region', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://xx.example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns a region if the subdomain is a valid 2 letter region', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://cz.example.com') });
      expect(result).to.deep.equal([{ region: 'CZ', type: 'subdomain' }]);
    });

    it('returns a region if the subdomain is a valid 3 letter region', () => {
      const result = checkSubdomain({ baseUrl: new URL('https://svn.example.com') });
      expect(result).to.deep.equal([{ region: 'SI', type: 'subdomain' }]);
    });
  });

  describe('checkPath', () => {
    it('returns an empty array if the url does not have a path', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com') });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if the path does not have any locale segments', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog') });
      expect(result).to.deep.equal([]);
    });

    it('respects only the first two segments of the path', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/ca/en/fr') });
      expect(result).to.deep.equal([{ language: 'en', region: 'CA', type: 'path' }]);
    });

    it('returns an empty array if the path is not a valid locale', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/xx') });
      expect(result).to.deep.equal([]);
    });

    it('returns a language if the path is a valid language', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/en') });
      expect(result).to.deep.equal([{ language: 'en', type: 'path' }]);
    });

    it('returns a language and region if the path is a valid language and region', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/ch/fr') });
      expect(result).to.deep.equal([{ language: 'fr', region: 'CH', type: 'path' }]);
    });

    it('returns a language and region if the path is a valid BCP 47 with dash', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/en-us') });
      expect(result).to.deep.equal([{ language: 'en', region: 'US', type: 'path' }]);
    });

    it('returns a language and region if the path is a valid BCP 47 with underscore', () => {
      const result = checkPath({ baseUrl: new URL('https://example.com/blog/en_US') });
      expect(result).to.deep.equal([{ language: 'en', region: 'US', type: 'path' }]);
    });
  });

  describe('checkHeaders', () => {
    it('returns an empty array if no relevant headers are set', () => {
      const result = checkHeaders({ headers: {} });
      expect(result).to.deep.equal([]);
    });

    it('returns a locale for content-language header', () => {
      const result = checkHeaders({ headers: { 'content-language': 'de-CH' } });
      expect(result).to.deep.equal([{ language: 'de', region: 'CH', type: 'header' }]);
    });

    it('returns a locale for x-content-language header', () => {
      const result = checkHeaders({ headers: { 'x-content-language': 'en-CA' } });
      expect(result).to.deep.equal([{ language: 'en', region: 'CA', type: 'header' }]);
    });

    it('returns multiple locales for multi-value header value', () => {
      const result = checkHeaders({ headers: { 'content-language': 'de-DE, en-CA' } });
      expect(result).to.deep.equal([
        { language: 'de', region: 'DE', type: 'header' },
        { language: 'en', region: 'CA', type: 'header' },
      ]);
    });
  });

  describe('checkHtmlLang', () => {
    it('returns an empty array if the html lang is not set', () => {
      const $ = cheerio.load('<html></html>');
      const result = checkHtmlLang({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns a locale if the html lang is set', () => {
      const $ = cheerio.load('<html lang="en-US"></html>');
      const result = checkHtmlLang({ $ });
      expect(result).to.deep.equal([{ language: 'en', region: 'US', type: 'html' }]);
    });

    it('returns an empty array if the html lang is set to an invalid locale', () => {
      const $ = cheerio.load('<html lang="something"></html>');
      const result = checkHtmlLang({ $ });
      expect(result).to.deep.equal([]);
    });
  });

  describe('checkMetaTags', () => {
    it('returns an empty array if no relevant meta tags are set', () => {
      const $ = cheerio.load('<html></html>');
      const result = checkMetaTags({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns a locale for content-language meta tag', () => {
      const $ = cheerio.load('<html><head><meta http-equiv="content-language" content="en-US"></head></html>');
      const result = checkMetaTags({ $ });
      expect(result).to.deep.equal([{ language: 'en', region: 'US', type: 'metaTag' }]);
    });

    it('returns a locale for og:locale meta tag', () => {
      const $ = cheerio.load('<html><head><meta property="og:locale" content="en-US"></head></html>');
      const result = checkMetaTags({ $ });
      expect(result).to.deep.equal([{ language: 'en', region: 'US', type: 'metaTag' }]);
    });

    it('ignores meta tags with no content', () => {
      const $ = cheerio.load('<html><head><meta http-equiv="content-language"></head></html>');
      const result = checkMetaTags({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns multiple locales for multi-value meta tag value', () => {
      const $ = cheerio.load('<html><head><meta http-equiv="content-language" content="de-CH, de"></head></html>');
      const result = checkMetaTags({ $ });
      expect(result).to.deep.equal([{ language: 'de', region: 'CH', type: 'metaTag' }, { language: 'de', type: 'metaTag' }]);
    });
  });

  describe('checkHrefLang', () => {
    it('returns an empty array if no relevant href lang tags are set', () => {
      const $ = cheerio.load('<html></html>');
      const result = checkHrefLang({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if no hreflang matches the base url', () => {
      const $ = cheerio.load('<html><head><link rel="alternate" hreflang="de-at" href="https://www.example.com/at/"></head></html>');
      const baseUrl = new URL('https://www.example.com/uk/');
      const result = checkHrefLang({ $, baseUrl });
      expect(result).to.deep.equal([]);
    });

    it('ignores default hreflang elements', () => {
      const $ = cheerio.load('<html><head><link rel="alternate" hreflang="x-default" href="https://www.example.com/at/"></head></html>');
      const baseUrl = new URL('https://www.example.com/at/');
      const result = checkHrefLang({ $, baseUrl });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if hreflang has invalid locale', () => {
      const $ = cheerio.load('<html><head><link rel="alternate" hreflang="xx-xx" href="https://www.example.com/at/"></head></html>');
      const baseUrl = new URL('https://www.example.com/at/');
      const result = checkHrefLang({ $, baseUrl });
      expect(result).to.deep.equal([]);
    });

    it('returns a locale for matching hreflang tag', () => {
      const $ = cheerio.load('<html><head><link rel="alternate" hreflang="de-at" href="https://www.example.com/at/"></head></html>');
      const baseUrl = new URL('https://www.example.com/at/');
      const result = checkHrefLang({ $, baseUrl });
      expect(result).to.deep.equal([{ language: 'de', region: 'AT', type: 'hreflang' }]);
    });
  });

  describe('checkContentLanguage', () => {
    it('returns an empty array if no description meta tag is available', () => {
      const $ = cheerio.load('<html><head></head></html>');
      const result = checkContentLanguage({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns an empty array if no language can be derived from the description', () => {
      const $ = cheerio.load('<html><head><meta name="description" content="123 4567 890"></head></html>');
      const result = checkContentLanguage({ $ });
      expect(result).to.deep.equal([]);
    });

    it('returns a locale if the language can be derived from the description', () => {
      const $ = cheerio.load('<html><head><meta name="description" content="C\'est un description française"></head></html>');
      const result = checkContentLanguage({ $ });
      expect(result).to.deep.equal([{ language: 'fr', type: 'content' }]);
    });
  });
});
