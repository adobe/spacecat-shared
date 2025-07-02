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
import {
  COUNTRY_PATTERNS,
  PAGE_PATTERNS,
  USER_AGENT_PATTERNS,
  getProviderPattern,
} from '../src/constants.js';

describe('constants', () => {
  describe('COUNTRY_PATTERNS', () => {
    it('has expected pattern count', () => {
      expect(COUNTRY_PATTERNS).to.be.an('array');
      expect(COUNTRY_PATTERNS).to.have.length(8);
    });

    it('contains locale dash pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'locale_dash_full');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains locale underscore pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'locale_underscore_full');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains global prefix pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'global_prefix');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains countries prefix pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'countries_prefix');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains lang/country pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'lang_country');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains 2-letter path pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'path_2letter_full');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains country query parameter pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'query_country');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    it('contains locale query parameter pattern', () => {
      const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'query_locale');
      expect(pattern).to.exist;
      expect(pattern.regex).to.be.a('string');
    });

    describe('regex patterns functionality', () => {
      it('locale dash pattern matches correctly', () => {
        const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'locale_dash_full');
        const regex = new RegExp(pattern.regex, 'i');

        expect(regex.test('/en-us/')).to.be.true;
        expect(regex.test('/fr-ca/')).to.be.true;
        expect(regex.test('https://example.com/de-de/page')).to.be.true;
        expect(regex.test('/en-us')).to.be.true;
        expect(regex.test('/invalid')).to.be.false;
      });

      it('country query parameter pattern matches correctly', () => {
        const pattern = COUNTRY_PATTERNS.find((p) => p.name === 'query_country');
        const regex = new RegExp(pattern.regex, 'i');

        expect(regex.test('?country=us')).to.be.true;
        expect(regex.test('&country=fr')).to.be.true;
        expect(regex.test('?country=usa')).to.be.true;
        expect(regex.test('?other=value&country=gb')).to.be.true;
        expect(regex.test('?invalid=country')).to.be.false;
      });
    });
  });

  describe('PAGE_PATTERNS', () => {
    it('has expected pattern count', () => {
      expect(PAGE_PATTERNS).to.be.an('array');
      expect(PAGE_PATTERNS).to.have.length(2);
    });

    it('contains robots pattern', () => {
      const pattern = PAGE_PATTERNS.find((p) => p.name === 'Robots');
      expect(pattern).to.exist;
      expect(pattern.pattern).to.equal('.*/robots\\.txt$');
    });

    it('contains sitemap pattern', () => {
      const pattern = PAGE_PATTERNS.find((p) => p.name === 'Sitemap');
      expect(pattern).to.exist;
      expect(pattern.pattern).to.equal('.*/sitemap.*\\.xml$');
    });

    describe('regex patterns functionality', () => {
      it('robots pattern matches correctly', () => {
        const pattern = PAGE_PATTERNS.find((p) => p.name === 'Robots');
        const regex = new RegExp(pattern.pattern);

        expect(regex.test('/robots.txt')).to.be.true;
        expect(regex.test('https://example.com/robots.txt')).to.be.true;
        expect(regex.test('/path/to/robots.txt')).to.be.true;
        expect(regex.test('/robots.html')).to.be.false;
      });

      it('sitemap pattern matches correctly', () => {
        const pattern = PAGE_PATTERNS.find((p) => p.name === 'Sitemap');
        const regex = new RegExp(pattern.pattern);

        expect(regex.test('/sitemap.xml')).to.be.true;
        expect(regex.test('/sitemap-index.xml')).to.be.true;
        expect(regex.test('/sitemaps/sitemap1.xml')).to.be.true;
        expect(regex.test('https://example.com/sitemap.xml')).to.be.true;
        expect(regex.test('/sitemap.txt')).to.be.false;
      });
    });
  });

  describe('USER_AGENT_PATTERNS', () => {
    it('has expected patterns', () => {
      expect(USER_AGENT_PATTERNS).to.be.an('object');
      expect(USER_AGENT_PATTERNS).to.have.property('chatgpt');
      expect(USER_AGENT_PATTERNS).to.have.property('perplexity');
      expect(USER_AGENT_PATTERNS).to.have.property('claude');
      expect(USER_AGENT_PATTERNS).to.have.property('gemini');
      expect(USER_AGENT_PATTERNS).to.have.property('copilot');
    });

    it('has correct ChatGPT pattern', () => {
      expect(USER_AGENT_PATTERNS.chatgpt).to.equal('(?i)ChatGPT|GPTBot|OAI-SearchBot');
    });

    it('has correct Perplexity pattern', () => {
      expect(USER_AGENT_PATTERNS.perplexity).to.equal('(?i)Perplexity');
    });

    it('has correct Claude pattern', () => {
      expect(USER_AGENT_PATTERNS.claude).to.equal('(?i)Claude|Anthropic');
    });

    it('has correct Gemini pattern', () => {
      expect(USER_AGENT_PATTERNS.gemini).to.equal('(?i)Gemini');
    });

    it('has correct Copilot pattern', () => {
      expect(USER_AGENT_PATTERNS.copilot).to.equal('(?i)Copilot');
    });
  });

  describe('getProviderPattern', () => {
    it('returns correct pattern for valid provider', () => {
      expect(getProviderPattern('CHATGPT')).to.equal('(?i)ChatGPT|GPTBot|OAI-SearchBot');
      expect(getProviderPattern('PERPLEXITY')).to.equal('(?i)Perplexity');
      expect(getProviderPattern('CLAUDE')).to.equal('(?i)Claude|Anthropic');
      expect(getProviderPattern('GEMINI')).to.equal('(?i)Gemini');
      expect(getProviderPattern('COPILOT')).to.equal('(?i)Copilot');
    });

    it('handles lowercase provider names', () => {
      expect(getProviderPattern('chatgpt')).to.equal('(?i)ChatGPT|GPTBot|OAI-SearchBot');
      expect(getProviderPattern('perplexity')).to.equal('(?i)Perplexity');
    });

    it('returns empty string for invalid provider', () => {
      expect(getProviderPattern('INVALID')).to.equal('');
      expect(getProviderPattern('UNKNOWN')).to.equal('');
    });

    it('returns empty string for null/undefined provider', () => {
      expect(getProviderPattern(null)).to.equal('');
      expect(getProviderPattern(undefined)).to.equal('');
    });
  });
});
