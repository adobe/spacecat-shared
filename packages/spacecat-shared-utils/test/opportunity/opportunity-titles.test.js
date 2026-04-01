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
  OPPORTUNITY_TITLES,
  getOpportunityTitle,
} from '../../src/opportunity/opportunity-titles.js';

describe('opportunity-titles', () => {
  describe('OPPORTUNITY_TITLES', () => {
    it('is a non-empty object', () => {
      expect(OPPORTUNITY_TITLES).to.be.an('object');
      expect(Object.keys(OPPORTUNITY_TITLES).length).to.be.greaterThan(0);
    });

    it('has correct title for cwv', () => {
      expect(OPPORTUNITY_TITLES.cwv).to.equal('Core Web Vitals');
    });

    it('has correct title for meta-tags', () => {
      expect(OPPORTUNITY_TITLES['meta-tags']).to.equal('SEO Meta Tags');
    });

    it('has correct title for toc', () => {
      expect(OPPORTUNITY_TITLES.toc).to.equal('Table of Contents');
    });

    it('covers all known opportunity types', () => {
      const expectedTypes = [
        'cwv', 'prerender',
        'broken-backlinks', 'broken-internal-links', 'canonical', 'hreflang',
        'meta-tags', 'sitemap', 'sitemap-product-coverage', 'structured-data', 'redirect-chains',
        'accessibility', 'alt-text', 'headings', 'no-cta-above-the-fold', 'readability',
        'high-form-views-low-conversions', 'high-page-views-low-form-nav',
        'high-page-views-low-form-views', 'form-accessibility',
        'high-organic-low-ctr',
        'product-metatags',
        'security-csp', 'security-vulnerabilities', 'security-permissions',
        'security-permissions-redundant',
        'llm-blocked', 'llm-error-pages', 'faqs', 'related-urls', 'toc',
        'experimentation-ess-daily', 'experimentation-ess-monthly',
        'cited-analysis', 'wikipedia-analysis', 'reddit-analysis', 'youtube-analysis',
        'info-gain',
      ];
      expectedTypes.forEach((type) => {
        expect(OPPORTUNITY_TITLES).to.have.property(type);
      });
    });
  });

  describe('getOpportunityTitle', () => {
    it('returns correct title for known type', () => {
      expect(getOpportunityTitle('cwv')).to.equal('Core Web Vitals');
      expect(getOpportunityTitle('broken-backlinks')).to.equal('Broken Backlinks');
      expect(getOpportunityTitle('toc')).to.equal('Table of Contents');
    });

    it('falls back to Title Case for unknown type', () => {
      expect(getOpportunityTitle('some-new-opportunity')).to.equal('Some New Opportunity');
    });

    it('handles single-word unknown type', () => {
      expect(getOpportunityTitle('unknown')).to.equal('Unknown');
    });
  });
});
