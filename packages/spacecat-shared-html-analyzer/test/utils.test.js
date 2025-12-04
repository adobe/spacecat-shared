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

import { expect } from 'chai';
import {
  tokenize,
  countWords,
  countLines,
  diffTokens,
  generateDiffReport,
  hashDJB2,
  pct,
  formatNumberToK,
} from '../src/index.js';

describe('Utility Functions', () => {
  describe('Tokenization', () => {
    it('should tokenize text into words', () => {
      const text = 'Hello, world! Visit https://example.com for more.';
      const tokens = tokenize(text, 'word');

      expect(tokens).to.deep.equal([
        'Hello,',
        'world!',
        'Visit',
        'https://example.com',
        'for',
        'more.',
      ]);
    });

    it('should tokenize text into lines', () => {
      const text = 'Line 1\n\nLine 2\nLine 3';
      const tokens = tokenize(text, 'line');

      expect(tokens).to.deep.equal([
        'Line 1',
        'Line 2',
        'Line 3',
      ]);
    });

    it('should preserve URLs as single tokens', () => {
      const text = 'Visit https://example.com and www.test.org for info@example.com';
      const tokens = tokenize(text, 'word');

      expect(tokens).to.include('https://example.com');
      expect(tokens).to.include('www.test.org');
      expect(tokens).to.include('info@example.com');
    });
  });

  describe('Word and Line Counting', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello world')).to.equal(2);
      expect(countWords('One two three four')).to.equal(4);
      expect(countWords('')).to.equal(0);
    });

    it('should count lines correctly', () => {
      expect(countLines('Line 1\nLine 2\nLine 3')).to.equal(3);
      expect(countLines('Single line')).to.equal(1);
      expect(countLines('')).to.equal(0);
    });
  });

  describe('Number Formatting', () => {
    it('should format numbers to K/M format', () => {
      const testCases = [
        { input: 500, expected: '500' },
        { input: 1000, expected: '1000' }, // formatNumberToK only formats >= 10000
        { input: 15000, expected: '15K' },
        { input: 1500000, expected: '1.5M' },
        { input: 2000000, expected: '2M' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(formatNumberToK(input)).to.equal(expected);
      });
    });

    it('should format percentages', () => {
      const testCases = [
        { input: 0.5, expected: '50.0%' },
        { input: 0.333, expected: '33.3%' },
        { input: 1, expected: '100.0%' },
        { input: 0, expected: '0.0%' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(pct(input)).to.equal(expected);
      });
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent hashes', () => {
      const text = 'Hello, world!';
      const hash1 = hashDJB2(text);
      const hash2 = hashDJB2(text);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.be.a('string');
    });

    it('should generate different hashes for different texts', () => {
      const hash1 = hashDJB2('Hello');
      const hash2 = hashDJB2('World');

      expect(hash1).to.not.equal(hash2);
    });

    it('should handle empty strings', () => {
      const hash = hashDJB2('');
      expect(hash).to.be.a('string');
    });
  });

  describe('Token Diffing', () => {
    it('should detect additions', () => {
      const original = 'Hello world';
      const modified = 'Hello beautiful world';
      const diff = diffTokens(original, modified, 'word');

      const addedTokens = diff.filter((op) => op.type === 'add');
      expect(addedTokens).to.have.lengthOf(1);
      expect(addedTokens[0].text).to.equal('beautiful');
    });

    it('should detect deletions', () => {
      const original = 'Hello beautiful world';
      const modified = 'Hello world';
      const diff = diffTokens(original, modified, 'word');

      const deletedTokens = diff.filter((op) => op.type === 'del');
      expect(deletedTokens).to.have.lengthOf(1);
      expect(deletedTokens[0].text).to.equal('beautiful');
    });

    it('should detect same tokens', () => {
      const original = 'Hello world';
      const modified = 'Hello world';
      const diff = diffTokens(original, modified, 'word');

      const sameTokens = diff.filter((op) => op.type === 'same');
      expect(sameTokens).to.have.lengthOf(2);
    });

    it('should handle empty strings', () => {
      const diff = diffTokens('', 'Hello', 'word');
      expect(diff).to.have.lengthOf(1);
      expect(diff[0].type).to.equal('add');
    });
  });

  describe('Diff Report Generation', () => {
    it('should generate a complete diff report', () => {
      const original = 'Hello world';
      const modified = 'Hello beautiful world';
      const report = generateDiffReport(original, modified, 'word');

      expect(report).to.have.property('addCount');
      expect(report).to.have.property('delCount');
      expect(report).to.have.property('sameCount');
      expect(report).to.have.property('diffOps');
      expect(report).to.have.property('summary');

      expect(report.addCount).to.equal(1);
      expect(report.delCount).to.equal(0);
      expect(report.sameCount).to.equal(2);
    });

    it('should handle empty strings gracefully', () => {
      const report = generateDiffReport('', '', 'word');

      expect(report.addCount).to.equal(0);
      expect(report.delCount).to.equal(0);
      expect(report.sameCount).to.equal(0);
      expect(report.summary).to.include('No text to compare');
    });

    it('should work with line-based granularity', () => {
      const original = 'Line 1\nLine 2';
      const modified = 'Line 1\nLine 3';
      const report = generateDiffReport(original, modified, 'line');

      expect(report.addCount).to.equal(1);
      expect(report.delCount).to.equal(1);
      expect(report.sameCount).to.equal(1);
    });
  });
});
