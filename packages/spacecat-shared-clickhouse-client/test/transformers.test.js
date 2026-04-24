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
import { toBrandPresenceExecution, toBrandPresenceCompetitorData } from '../src/transformers.js';

// Claude Code, Model: Sonnet 4.6 - Prompt: "write unit tests for the transformers,
// follow AAA pattern and coverage should be 80% at least"
describe('transformers', () => {
  describe('toBrandPresenceExecution', () => {
    // Claude Code, Model: Sonnet 4.6 - Prompt: "please create a valid brand presence execution
    // object based on the schema
    const raw = {
      site_id: '94d151ff-09d2-4462-9703-4956e635425f',
      platform: 'google-ai-overviews',
      week: '2025-W47',
      execution_date: '2025-11-23',
      category: 'Dining Room',
      topic: 'oak dining table',
      prompt: 'What size oak dining table do I need for 6 people?',
      origin: 'HUMAN',
      region: 'GB',
      volume: '-20',
      user_intent: 'informational',
      answer: 'Oakwood Living solid oak dining tables are available in fixed and extending configurations.',
      sources: 'oakwoodliving.co.uk;johnlewis.com',
      citations: true,
      answer_contains_brandname: false,
      sentiment: 'neutral',
      business_competitors: 'IKEA;John Lewis;DFS',
      is_answered: true,
      position: '2',
      visibility_score: '54',
      detected_brand_mentions: null,
      error_code: null,
      citation_sample_size: 1,
      citation_answers_with_citations: 1,
      citation_potential: 'n/a',
      updated_at: '2025-11-23T00:00:00.000Z',
    };

    it('maps string fields as is', () => {
      const result = toBrandPresenceExecution(raw);
      expect(result.site_id).to.equal('94d151ff-09d2-4462-9703-4956e635425f');
      expect(result.platform).to.equal('google-ai-overviews');
      expect(result.week).to.equal('2025-W47');
      expect(result.execution_date).to.equal('2025-11-23');
      expect(result.category).to.equal('Dining Room');
      expect(result.region).to.equal('gb');
      expect(result.answer).to.equal('Oakwood Living solid oak dining tables are available in fixed and extending configurations.');
    });

    it('lowercases region', () => {
      expect(toBrandPresenceExecution({ ...raw, region: 'GB' }).region).to.equal('gb');
    });

    it('parses volume and position as integers', () => {
      const result = toBrandPresenceExecution(raw);
      expect(result.volume).to.equal(-20);
      expect(result.position).to.equal(2);
    });

    it('parses visibility_score as integer', () => {
      expect(toBrandPresenceExecution(raw).visibility_score).to.equal(54);
    });

    it('defaults position to 0 when not parseable', () => {
      expect(toBrandPresenceExecution({ ...raw, position: null }).position).to.equal(0);
    });

    it('defaults visibility_score to 0 when not parseable', () => {
      expect(toBrandPresenceExecution(
        { ...raw, visibility_score: null },
      ).visibility_score).to.equal(0);
    });

    it('splits sources by semicolon into array', () => {
      expect(toBrandPresenceExecution(raw).sources).to.deep.equal(['oakwoodliving.co.uk', 'johnlewis.com']);
    });

    it('passes sources array as is', () => {
      expect(toBrandPresenceExecution({ ...raw, sources: ['s1', 's2'] }).sources).to.deep.equal(['s1', 's2']);
    });

    it('returns empty sources for empty string', () => {
      expect(toBrandPresenceExecution({ ...raw, sources: '' }).sources).to.deep.equal([]);
    });

    it('splits business_competitors by semicolon into array', () => {
      expect(toBrandPresenceExecution(raw).business_competitors).to.deep.equal(['IKEA', 'John Lewis', 'DFS']);
    });

    it('formats updated_at for ClickHouse', () => {
      expect(toBrandPresenceExecution(raw).updated_at).to.equal('2025-11-23 00:00:00');
    });

    it('defaults updated_at to current time when absent', () => {
      const rawWithoutDate = { ...raw };
      delete rawWithoutDate.updated_at;
      expect(toBrandPresenceExecution(rawWithoutDate).updated_at).to.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('preserves null fields as null', () => {
      const result = toBrandPresenceExecution(raw);
      expect(result.detected_brand_mentions).to.be.null;
      expect(result.error_code).to.be.null;
    });

    it('casts boolean fields', () => {
      const result = toBrandPresenceExecution(raw);
      expect(result.citations).to.be.true;
      expect(result.answer_contains_brandname).to.be.false;
      expect(result.is_answered).to.be.true;
    });
  });

  describe('toBrandPresenceCompetitorData', () => {
    const raw = {
      site_id: '94d151ff-09d2-4462-9703-4956e635425f',
      platform: 'google-ai-overviews',
      week: '2025-W47',
      category: 'Dining Room',
      business_competitors: 'IKEA;John Lewis;DFS',
      region: 'GB',
    };

    it('expands competitors into individual rows', () => {
      const result = toBrandPresenceCompetitorData(raw);
      expect(result).to.have.length(3);
      expect(result[0].competitor).to.equal('IKEA');
      expect(result[1].competitor).to.equal('John Lewis');
      expect(result[2].competitor).to.equal('DFS');
    });

    it('propagates shared fields to all rows', () => {
      const result = toBrandPresenceCompetitorData(raw);
      for (const row of result) {
        expect(row.site_id).to.equal('94d151ff-09d2-4462-9703-4956e635425f');
        expect(row.platform).to.equal('google-ai-overviews');
        expect(row.week).to.equal('2025-W47');
        expect(row.category).to.equal('Dining Room');
        expect(row.region).to.equal('gb');
      }
    });

    it('accepts an array of competitors as well as a semicolon string', () => {
      const result = toBrandPresenceCompetitorData({ ...raw, business_competitors: ['IKEA', 'Wayfair'] });
      expect(result).to.have.length(2);
      expect(result.map((r) => r.competitor)).to.deep.equal(['IKEA', 'Wayfair']);
    });

    it('returns empty array for empty competitors', () => {
      expect(toBrandPresenceCompetitorData({ ...raw, business_competitors: '' })).to.deep.equal([]);
    });

    it('returns empty array when competitors absent', () => {
      const row = { ...raw };
      delete row.business_competitors;
      expect(toBrandPresenceCompetitorData(row)).to.deep.equal([]);
    });
  });
});
