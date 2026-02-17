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
  isSuggestionComplete,
  isBrokenBacklinksComplete,
  isCwvComplete,
  isAltTextComplete,
  OPPORTUNITY_TYPES,
} from '../src/index.js';

describe('suggestion-complete', () => {
  describe('isSuggestionComplete', () => {
    it('returns false when suggestion is null or undefined', () => {
      expect(isSuggestionComplete(null, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.false;
      expect(isSuggestionComplete(undefined, OPPORTUNITY_TYPES.CWV)).to.be.false;
    });

    it('returns false when opportunityType is missing', () => {
      expect(isSuggestionComplete({ status: 'NEW', data: {} }, '')).to.be.false;
      expect(isSuggestionComplete({ status: 'NEW', data: {} }, null)).to.be.false;
    });

    it('returns false when status is not NEW', () => {
      const suggestion = {
        getStatus: () => 'APPROVED',
        getData: () => ({ url_to: 'https://a.com', url_from: 'https://b.com' }),
      };
      expect(isSuggestionComplete(suggestion, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.false;

      const plain = { status: 'FIXED', data: { url_to: 'https://a.com', url_from: 'https://b.com' } };
      expect(isSuggestionComplete(plain, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.false;
    });

    it('returns false when data is empty or missing', () => {
      expect(isSuggestionComplete({ status: 'NEW', data: {} }, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.false;
      expect(isSuggestionComplete({ status: 'NEW' }, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.false;
    });

    it('returns false for unsupported opportunity type', () => {
      const suggestion = { status: 'NEW', data: { url: 'https://example.com' } };
      expect(isSuggestionComplete(suggestion, 'unknown-type')).to.be.false;
    });

    describe('BROKEN_BACKLINKS', () => {
      it('returns true when status is NEW and data has url_to and url_from', () => {
        const suggestion = {
          getStatus: () => 'NEW',
          getData: () => ({ url_to: 'https://broken.com', url_from: 'https://source.com' }),
        };
        expect(isSuggestionComplete(suggestion, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.true;

        const plain = {
          status: 'NEW',
          data: { url_to: 'https://broken.com', url_from: 'https://source.com' },
        };
        expect(isSuggestionComplete(plain, OPPORTUNITY_TYPES.BROKEN_BACKLINKS)).to.be.true;
      });

      it('returns false when url_to or url_from is missing or empty', () => {
        expect(isSuggestionComplete(
          { status: 'NEW', data: { url_from: 'https://source.com' } },
          OPPORTUNITY_TYPES.BROKEN_BACKLINKS,
        )).to.be.false;
        expect(isSuggestionComplete(
          { status: 'NEW', data: { url_to: 'https://broken.com' } },
          OPPORTUNITY_TYPES.BROKEN_BACKLINKS,
        )).to.be.false;
        expect(isSuggestionComplete(
          { status: 'NEW', data: { url_to: '  ', url_from: 'https://source.com' } },
          OPPORTUNITY_TYPES.BROKEN_BACKLINKS,
        )).to.be.false;
      });
    });

    describe('CWV', () => {
      it('returns true when status is NEW and data is type url with url', () => {
        const suggestion = {
          getStatus: () => 'NEW',
          getData: () => ({ type: 'url', url: 'https://example.com/page' }),
        };
        expect(isSuggestionComplete(suggestion, OPPORTUNITY_TYPES.CWV)).to.be.true;
      });

      it('returns true when status is NEW and data is type group with pattern', () => {
        const suggestion = {
          status: 'NEW',
          data: { type: 'group', pattern: '/products/*' },
        };
        expect(isSuggestionComplete(suggestion, OPPORTUNITY_TYPES.CWV)).to.be.true;
      });

      it('returns false when CWV url is missing or empty', () => {
        expect(isSuggestionComplete(
          { status: 'NEW', data: { type: 'url' } },
          OPPORTUNITY_TYPES.CWV,
        )).to.be.false;
        expect(isSuggestionComplete(
          { status: 'NEW', data: { type: 'url', url: '   ' } },
          OPPORTUNITY_TYPES.CWV,
        )).to.be.false;
      });

      it('returns false when CWV group pattern is missing or empty', () => {
        expect(isSuggestionComplete(
          { status: 'NEW', data: { type: 'group' } },
          OPPORTUNITY_TYPES.CWV,
        )).to.be.false;
        expect(isSuggestionComplete(
          { status: 'NEW', data: { type: 'group', pattern: '' } },
          OPPORTUNITY_TYPES.CWV,
        )).to.be.false;
      });

      it('returns false for unknown CWV type', () => {
        expect(isSuggestionComplete(
          { status: 'NEW', data: { type: 'other' } },
          OPPORTUNITY_TYPES.CWV,
        )).to.be.false;
      });
    });

    describe('ALT_TEXT', () => {
      it('returns true when status is NEW and data has recommendations with pageUrl', () => {
        const suggestion = {
          getStatus: () => 'NEW',
          getData: () => ({
            recommendations: [
              { pageUrl: 'https://example.com/p1', imageUrl: 'https://example.com/img1.png' },
            ],
          }),
        };
        expect(isSuggestionComplete(suggestion, OPPORTUNITY_TYPES.ALT_TEXT)).to.be.true;
      });

      it('returns false when recommendations is missing or empty', () => {
        expect(isSuggestionComplete(
          { status: 'NEW', data: {} },
          OPPORTUNITY_TYPES.ALT_TEXT,
        )).to.be.false;
        expect(isSuggestionComplete(
          { status: 'NEW', data: { recommendations: [] } },
          OPPORTUNITY_TYPES.ALT_TEXT,
        )).to.be.false;
      });

      it('returns false when any recommendation is missing pageUrl or pageUrl is empty', () => {
        expect(isSuggestionComplete(
          {
            status: 'NEW',
            data: {
              recommendations: [
                { pageUrl: 'https://example.com/p1' },
                { imageUrl: 'https://example.com/img2.png' },
              ],
            },
          },
          OPPORTUNITY_TYPES.ALT_TEXT,
        )).to.be.false;
        expect(isSuggestionComplete(
          {
            status: 'NEW',
            data: {
              recommendations: [{ pageUrl: '  ' }],
            },
          },
          OPPORTUNITY_TYPES.ALT_TEXT,
        )).to.be.false;
      });
    });
  });

  describe('isBrokenBacklinksComplete', () => {
    it('returns true when data has url_to and url_from', () => {
      expect(isBrokenBacklinksComplete({ url_to: 'https://a.com', url_from: 'https://b.com' })).to.be.true;
    });

    it('returns false when url_to or url_from is missing or empty', () => {
      expect(isBrokenBacklinksComplete({})).to.be.false;
      expect(isBrokenBacklinksComplete({ url_from: 'https://b.com' })).to.be.false;
      expect(isBrokenBacklinksComplete({ url_to: 'https://a.com' })).to.be.false;
      expect(isBrokenBacklinksComplete({ url_to: '  ', url_from: 'https://b.com' })).to.be.false;
    });
  });

  describe('isCwvComplete', () => {
    it('returns true for type url with url', () => {
      expect(isCwvComplete({ type: 'url', url: 'https://example.com' })).to.be.true;
    });

    it('returns true for type group with pattern', () => {
      expect(isCwvComplete({ type: 'group', pattern: '/blog/*' })).to.be.true;
    });

    it('returns false for type url without url or empty url', () => {
      expect(isCwvComplete({ type: 'url' })).to.be.false;
      expect(isCwvComplete({ type: 'url', url: '' })).to.be.false;
    });

    it('returns false for type group without pattern or empty pattern', () => {
      expect(isCwvComplete({ type: 'group' })).to.be.false;
      expect(isCwvComplete({ type: 'group', pattern: '   ' })).to.be.false;
    });
  });

  describe('isAltTextComplete', () => {
    it('returns true when recommendations has items with pageUrl', () => {
      expect(isAltTextComplete({
        recommendations: [
          { pageUrl: 'https://example.com/p1' },
          { pageUrl: 'https://example.com/p2' },
        ],
      })).to.be.true;
    });

    it('returns false when recommendations is missing, empty, or item missing pageUrl', () => {
      expect(isAltTextComplete({})).to.be.false;
      expect(isAltTextComplete({ recommendations: [] })).to.be.false;
      expect(isAltTextComplete({ recommendations: [{}] })).to.be.false;
      expect(isAltTextComplete({ recommendations: [{ pageUrl: '' }] })).to.be.false;
    });
  });
});
