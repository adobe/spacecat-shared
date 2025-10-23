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
  extractUrlFromSuggestion,
  extractUrlFromOpportunity,
} from '../src/url-extractors.js';
import { OPPORTUNITY_TYPES } from '../src/constants.js';

describe('URL Extractors', () => {
  describe('extractUrlFromSuggestion', () => {
    describe('ALT_TEXT type', () => {
      it('extracts URLs from recommendations array', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ALT_TEXT,
        };
        const suggestion = {
          getData: () => ({
            recommendations: [
              { pageUrl: 'https://example.com/page1' },
              { pageUrl: 'https://example.com/page2' },
            ],
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page1', 'https://example.com/page2']);
      });

      it('handles missing recommendations', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ALT_TEXT,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });

      it('handles non-array recommendations', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ALT_TEXT,
        };
        const suggestion = {
          getData: () => ({
            recommendations: 'not an array',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });

      it('filters out non-string pageUrls', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ALT_TEXT,
        };
        const suggestion = {
          getData: () => ({
            recommendations: [
              { pageUrl: 'https://example.com/page1' },
              { pageUrl: null },
              { pageUrl: 123 },
              { pageUrl: 'https://example.com/page2' },
            ],
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page1', 'https://example.com/page2']);
      });
    });

    describe('URL-based types (ACCESSIBILITY, COLOR_CONTRAST, etc.)', () => {
      const urlBasedTypes = [
        OPPORTUNITY_TYPES.ACCESSIBILITY,
        OPPORTUNITY_TYPES.COLOR_CONTRAST,
        OPPORTUNITY_TYPES.STRUCTURED_DATA,
        OPPORTUNITY_TYPES.CANONICAL,
        OPPORTUNITY_TYPES.HREFLANG,
        OPPORTUNITY_TYPES.HEADINGS,
        OPPORTUNITY_TYPES.INVALID_OR_MISSING_METADATA,
        OPPORTUNITY_TYPES.SITEMAP_PRODUCT_COVERAGE,
      ];

      urlBasedTypes.forEach((type) => {
        it(`extracts URL for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
          };
          const suggestion = {
            getData: () => ({
              url: 'https://example.com/page',
            }),
          };

          const urls = extractUrlFromSuggestion({ opportunity, suggestion });
          expect(urls).to.deep.equal(['https://example.com/page']);
        });

        it(`handles missing URL for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
          };
          const suggestion = {
            getData: () => ({}),
          };

          const urls = extractUrlFromSuggestion({ opportunity, suggestion });
          expect(urls).to.deep.equal([]);
        });
      });
    });

    describe('CWV type', () => {
      it('extracts URL when type is "url"', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.CWV,
        };
        const suggestion = {
          getData: () => ({
            type: 'url',
            url: 'https://example.com/page',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page']);
      });

      it('does not extract URL when type is not "url"', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.CWV,
        };
        const suggestion = {
          getData: () => ({
            type: 'other',
            url: 'https://example.com/page',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });

      it('handles missing URL', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.CWV,
        };
        const suggestion = {
          getData: () => ({
            type: 'url',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('REDIRECT_CHAINS type', () => {
      it('extracts sourceUrl', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.REDIRECT_CHAINS,
        };
        const suggestion = {
          getData: () => ({
            sourceUrl: 'https://example.com/source',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/source']);
      });

      it('handles missing sourceUrl', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.REDIRECT_CHAINS,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('SECURITY_XSS type', () => {
      it('extracts link', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_XSS,
        };
        const suggestion = {
          getData: () => ({
            link: 'https://example.com/vulnerable',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/vulnerable']);
      });

      it('handles missing link', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_XSS,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('SECURITY_CSP type', () => {
      it('extracts URLs from findings array', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_CSP,
        };
        const suggestion = {
          getData: () => ({
            findings: [
              { url: 'https://example.com/page1' },
              { url: 'https://example.com/page2' },
            ],
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page1', 'https://example.com/page2']);
      });

      it('handles missing findings', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_CSP,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });

      it('filters out non-string URLs', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_CSP,
        };
        const suggestion = {
          getData: () => ({
            findings: [
              { url: 'https://example.com/page1' },
              { url: null },
              { url: 123 },
            ],
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page1']);
      });
    });

    describe('SECURITY_PERMISSIONS type', () => {
      it('extracts path', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_PERMISSIONS,
        };
        const suggestion = {
          getData: () => ({
            path: 'https://example.com/secure',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/secure']);
      });

      it('handles missing path', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SECURITY_PERMISSIONS,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('BROKEN_BACKLINKS and BROKEN_INTERNAL_LINKS types', () => {
      [OPPORTUNITY_TYPES.BROKEN_BACKLINKS,
        OPPORTUNITY_TYPES.BROKEN_INTERNAL_LINKS].forEach((type) => {
        it(`extracts url_to for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
          };
          const suggestion = {
            getData: () => ({
              url_to: 'https://example.com/broken',
            }),
          };

          const urls = extractUrlFromSuggestion({ opportunity, suggestion });
          expect(urls).to.deep.equal(['https://example.com/broken']);
        });

        it(`handles missing url_to for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
          };
          const suggestion = {
            getData: () => ({}),
          };

          const urls = extractUrlFromSuggestion({ opportunity, suggestion });
          expect(urls).to.deep.equal([]);
        });
      });
    });

    describe('SITEMAP type', () => {
      it('extracts pageUrl', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SITEMAP,
        };
        const suggestion = {
          getData: () => ({
            pageUrl: 'https://example.com/sitemap-page',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/sitemap-page']);
      });

      it('handles missing pageUrl', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.SITEMAP,
        };
        const suggestion = {
          getData: () => ({}),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('Unknown type', () => {
      it('returns empty array for unknown type', () => {
        const opportunity = {
          getType: () => 'unknown-type',
        };
        const suggestion = {
          getData: () => ({
            url: 'https://example.com/page',
          }),
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('Suggestion with data property instead of getData method', () => {
      it('handles suggestion with direct data property', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ACCESSIBILITY,
        };
        const suggestion = {
          data: {
            url: 'https://example.com/page',
          },
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal(['https://example.com/page']);
      });
    });

    describe('Error handling', () => {
      it('handles malformed data gracefully', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ACCESSIBILITY,
        };
        const suggestion = {
          getData: () => null,
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });

      it('handles error when getData throws exception', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.ACCESSIBILITY,
        };
        const suggestion = {
          getData: () => {
            throw new Error('getData failed');
          },
        };

        const urls = extractUrlFromSuggestion({ opportunity, suggestion });
        expect(urls).to.deep.equal([]);
      });
    });
  });

  describe('extractUrlFromOpportunity', () => {
    describe('HIGH_ORGANIC_LOW_CTR type', () => {
      it('extracts page URL', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          getData: () => ({
            page: 'https://example.com/page',
          }),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal(['https://example.com/page']);
      });

      it('handles missing page', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          getData: () => ({}),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });

      it('handles non-string page', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          getData: () => ({
            page: 123,
          }),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('Form-related types', () => {
      const formTypes = [
        OPPORTUNITY_TYPES.HIGH_FORM_VIEWS_LOW_CONVERSIONS,
        OPPORTUNITY_TYPES.HIGH_PAGE_VIEWS_LOW_FORM_NAV,
        OPPORTUNITY_TYPES.HIGH_PAGE_VIEWS_LOW_FORM_VIEWS,
      ];

      formTypes.forEach((type) => {
        it(`extracts form URL for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
            getData: () => ({
              form: 'https://example.com/form',
            }),
          };

          const urls = extractUrlFromOpportunity({ opportunity });
          expect(urls).to.deep.equal(['https://example.com/form']);
        });

        it(`handles missing form for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
            getData: () => ({}),
          };

          const urls = extractUrlFromOpportunity({ opportunity });
          expect(urls).to.deep.equal([]);
        });

        it(`handles non-string form for ${type} type`, () => {
          const opportunity = {
            getType: () => type,
            getData: () => ({
              form: null,
            }),
          };

          const urls = extractUrlFromOpportunity({ opportunity });
          expect(urls).to.deep.equal([]);
        });
      });
    });

    describe('FORM_ACCESSIBILITY type', () => {
      it('extracts URL', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.FORM_ACCESSIBILITY,
          getData: () => ({
            url: 'https://example.com/accessible-form',
          }),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal(['https://example.com/accessible-form']);
      });

      it('handles missing URL', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.FORM_ACCESSIBILITY,
          getData: () => ({}),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('Unknown type', () => {
      it('returns empty array for unknown type', () => {
        const opportunity = {
          getType: () => 'unknown-type',
          getData: () => ({
            page: 'https://example.com/page',
          }),
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });
    });

    describe('Opportunity with data property instead of getData method', () => {
      it('handles opportunity with direct data property', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          data: {
            page: 'https://example.com/page',
          },
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal(['https://example.com/page']);
      });
    });

    describe('Error handling', () => {
      it('handles malformed data gracefully', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          getData: () => null,
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });

      it('handles error when getData throws exception', () => {
        const opportunity = {
          getType: () => OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR,
          getData: () => {
            throw new Error('getData failed');
          },
        };

        const urls = extractUrlFromOpportunity({ opportunity });
        expect(urls).to.deep.equal([]);
      });
    });
  });
});
