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
import { VALIDATORS } from '../src/validators.js';

describe('VALIDATORS', () => {
  describe('brand_presence_executions', () => {
    const validate = VALIDATORS.brand_presence_executions;

    const validRow = {
      site_id: '94d151ff-09d2-4462-9703-4956e635425f',
      platform: 'google-ai-overviews',
      week: '2025-W47',
      execution_date: '2025-11-23',
      category: 'Dining Room',
      topic: 'oak dining table',
      prompt: 'What size oak dining table do I need for 6 people?',
      region: 'gb',
      answer: 'Oakwood Living solid oak dining tables are available in fixed and extending configurations.',
    };

    it('S-05: returns an error when visibility_score is below 0', () => {
      expect(validate({ ...validRow, visibility_score: -1.0 }).some((e) => e.field === 'visibility_score')).to.be.true;
    });

    it('S-05: returns an error when visibility_score is above 100', () => {
      expect(validate({ ...validRow, visibility_score: 100.1 }).some((e) => e.field === 'visibility_score')).to.be.true;
    });

    it('S-05: accepts visibility_score at boundary values 0 and 100', () => {
      expect(validate({ ...validRow, visibility_score: 0 })).to.deep.equal([]);
      expect(validate({ ...validRow, visibility_score: 100 })).to.deep.equal([]);
    });

    it('S-05: skips visibility_score range check when it is not a number', () => {
      expect(validate({ ...validRow, visibility_score: '-1' }).some((e) => e.field === 'visibility_score')).to.be.false;
    });

    it('S-06: accepts object without optional fields volume, business_competitors, and organic_competitors', () => {
      const row = { ...validRow };
      delete row.volume;
      delete row.business_competitors;
      delete row.organic_competitors;
      expect(validate(row)).to.deep.equal([]);
    });

    it('accepts valid sentiment values', () => {
      for (const sentiment of ['positive', 'neutral', 'negative']) {
        expect(validate({ ...validRow, sentiment })).to.deep.equal([]);
      }
    });

    it('returns an error for an invalid sentiment value', () => {
      expect(validate({ ...validRow, sentiment: 'unknown' }).some((e) => e.field === 'sentiment')).to.be.true;
    });

    it('accepts valid origin values', () => {
      for (const origin of ['HUMAN', 'AI']) {
        expect(validate({ ...validRow, origin })).to.deep.equal([]);
      }
    });

    it('returns an error for an invalid origin value', () => {
      expect(validate({ ...validRow, origin: 'BOT' }).some((e) => e.field === 'origin')).to.be.true;
    });
  });

  describe('brand_presence_competitor_data', () => {
    const validate = VALIDATORS.brand_presence_competitor_data;

    const validRow = {
      site_id: '94d151ff-09d2-4462-9703-4956e635425f',
      platform: 'google-ai-overviews',
      week: '2025-W47',
      category: 'Dining Room',
      competitor: 'IKEA',
      region: 'gb',
    };

    it('accepts a valid object with all required fields', () => {
      expect(validate(validRow)).to.deep.equal([]);
    });

    it('returns an error when a required field is not a string', () => {
      expect(validate({ ...validRow, site_id: 123 }).some((e) => e.field === 'site_id')).to.be.true;
    });
  });
});
