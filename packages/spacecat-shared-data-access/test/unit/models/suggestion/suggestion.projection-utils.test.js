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

import { FIELD_TRANSFORMERS, FALLBACK_PROJECTION } from '../../../../src/models/suggestion/suggestion.projection-utils.js';

describe('Suggestion Projection Utils', () => {
  describe('FIELD_TRANSFORMERS', () => {
    describe('filterIssuesOccurrences', () => {
      it('filters issues to only include occurrences', () => {
        const issues = [
          { occurrences: 5, severity: 'high', description: 'test' },
          { occurrences: 3, severity: 'low', description: 'test2' },
        ];

        const result = FIELD_TRANSFORMERS.filterIssuesOccurrences(issues);

        expect(result).to.deep.equal([
          { occurrences: 5 },
          { occurrences: 3 },
        ]);
      });

      it('returns non-array values unchanged', () => {
        expect(FIELD_TRANSFORMERS.filterIssuesOccurrences(null)).to.be.null;
        expect(FIELD_TRANSFORMERS.filterIssuesOccurrences('string')).to.equal('string');
      });
    });

    describe('filterCwvMetrics', () => {
      it('filters metrics to essential CWV fields', () => {
        const metrics = [
          {
            deviceType: 'mobile',
            lcp: 2500,
            inp: 200,
            cls: 0.1,
            pageviews: 1000,
            organic: 500,
          },
          {
            deviceType: 'desktop',
            lcp: 1800,
            inp: 100,
            cls: 0.05,
            pageviews: 800,
            organic: 400,
          },
        ];

        const result = FIELD_TRANSFORMERS.filterCwvMetrics(metrics);

        expect(result).to.deep.equal([
          {
            deviceType: 'mobile', lcp: 2500, inp: 200, cls: 0.1,
          },
          {
            deviceType: 'desktop', lcp: 1800, inp: 100, cls: 0.05,
          },
        ]);
      });

      it('returns non-array values unchanged', () => {
        expect(FIELD_TRANSFORMERS.filterCwvMetrics(null)).to.be.null;
        expect(FIELD_TRANSFORMERS.filterCwvMetrics({})).to.deep.equal({});
      });
    });

    describe('extractPageUrlFromRecommendations', () => {
      it('extracts pageUrl from recommendations', () => {
        const recommendations = [
          { pageUrl: 'https://example.com/1', altText: 'test1', xpath: '/html/img' },
          { pageUrl: 'https://example.com/2', altText: 'test2', xpath: '/html/img2' },
        ];

        const result = FIELD_TRANSFORMERS.extractPageUrlFromRecommendations(recommendations);

        expect(result).to.deep.equal([
          { pageUrl: 'https://example.com/1' },
          { pageUrl: 'https://example.com/2' },
        ]);
      });

      it('returns non-array values unchanged', () => {
        expect(FIELD_TRANSFORMERS.extractPageUrlFromRecommendations(null)).to.be.null;
        expect(FIELD_TRANSFORMERS.extractPageUrlFromRecommendations('string')).to.equal('string');
      });
    });

    describe('extractCveUrls', () => {
      it('extracts URLs from CVEs', () => {
        const cves = [
          { url: 'https://cve.mitre.org/1', cve_id: 'CVE-2021-1234', summary: 'test' },
          { url: 'https://cve.mitre.org/2', cve_id: 'CVE-2021-5678', summary: 'test2' },
        ];

        const result = FIELD_TRANSFORMERS.extractCveUrls(cves);

        expect(result).to.deep.equal([
          { url: 'https://cve.mitre.org/1' },
          { url: 'https://cve.mitre.org/2' },
        ]);
      });

      it('returns non-array values unchanged', () => {
        expect(FIELD_TRANSFORMERS.extractCveUrls(null)).to.be.null;
        expect(FIELD_TRANSFORMERS.extractCveUrls('string')).to.equal('string');
      });
    });
  });

  describe('FALLBACK_PROJECTION', () => {
    it('has minimal view configuration', () => {
      expect(FALLBACK_PROJECTION).to.have.property('minimal');
      expect(FALLBACK_PROJECTION.minimal).to.have.property('fields');
      expect(FALLBACK_PROJECTION.minimal.fields).to.be.an('array');
      expect(FALLBACK_PROJECTION.minimal.fields).to.include('url');
    });

    it('has empty transformers by default', () => {
      expect(FALLBACK_PROJECTION.minimal.transformers).to.deep.equal({});
    });

    it('includes common URL fields', () => {
      const { fields } = FALLBACK_PROJECTION.minimal;
      expect(fields).to.include('url');
      expect(fields).to.include('pageUrl');
      expect(fields).to.include('url_from');
      expect(fields).to.include('url_to');
      expect(fields).to.include('pattern');
    });

    it('does not include data fields (conservative approach)', () => {
      const { fields } = FALLBACK_PROJECTION.minimal;
      // Ensure fallback is truly minimal - no data fields
      expect(fields).to.not.include('recommendations');
      expect(fields).to.not.include('cves');
      expect(fields).to.not.include('findings');
      expect(fields).to.not.include('form');
      expect(fields).to.not.include('page');
      expect(fields).to.not.include('accessibility');
      expect(fields).to.not.include('metrics');
      expect(fields).to.not.include('type');
      expect(fields).to.not.include('pageviews');
      expect(fields).to.not.include('issues');
    });

    it('has exactly 14 URL-related fields', () => {
      expect(FALLBACK_PROJECTION.minimal.fields).to.have.lengthOf(14);
    });
  });
});
