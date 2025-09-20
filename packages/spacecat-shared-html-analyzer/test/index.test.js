/*
 * Copyright 2023 Adobe. All rights reserved.
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
  analyzeVisibility,
  quickCompare,
  getCitationReadiness,
  stripTagsToText,
  calculateSimilarity,
} from '../src/index.js';

describe('HTML Visibility Analyzer', () => {
  const simpleHtml = '<html><body><h1>Title</h1><p>Content here</p></body></html>';
  const richHtml = '<html><body><h1>Title</h1><p>Content here</p><script>console.log("loaded")</script><div class="dynamic">Dynamic content</div></body></html>';

  describe('analyzeVisibility', () => {
    it('should analyze content differences', async () => {
      const result = await analyzeVisibility(simpleHtml, richHtml);

      expect(result).to.have.property('metrics');
      expect(result.metrics).to.have.property('contentGain');
      expect(result.metrics).to.have.property('citationReadability');
      expect(result.metrics).to.have.property('missingWords');
      expect(result.metrics).to.have.property('similarity');
      expect(result).to.have.property('visibilityScore');
    });

    it('should handle identical content', async () => {
      const result = await analyzeVisibility(simpleHtml, simpleHtml);

      expect(result.metrics.contentGain).to.equal(1);
      expect(result.metrics.missingWords).to.equal(0);
      expect(result.metrics.citationReadability).to.equal(100);
      expect(result.visibilityScore.score).to.be.greaterThan(90);
    });

    it('should handle empty content', async () => {
      const result = await analyzeVisibility('', richHtml);

      expect(result.metrics.contentGain).to.be.at.least(1);
      // Empty initial HTML = 0% visible to crawlers
      expect(result.metrics.citationReadability).to.equal(0);
    });
  });

  describe('quickCompare', () => {
    it('should provide quick comparison metrics', async () => {
      const result = await quickCompare(simpleHtml, richHtml);

      expect(result).to.have.property('wordCount');
      expect(result).to.have.property('contentGain');
      expect(result).to.have.property('missingWords');
      expect(result).to.have.property('similarity');

      expect(result.wordCount).to.have.property('first');
      expect(result.wordCount).to.have.property('second');
      expect(result.wordCount).to.have.property('difference');
    });
  });

  describe('getCitationReadiness', () => {
    it('should provide citation readiness score', async () => {
      const result = await getCitationReadiness(simpleHtml, richHtml);

      expect(result).to.have.property('score');
      expect(result).to.have.property('category');
      expect(result).to.have.property('description');
      expect(result).to.have.property('metrics');
      expect(result).to.have.property('recommendations');

      expect(result.score).to.be.a('number');
      expect(result.score).to.be.at.least(0);
      expect(result.score).to.be.at.most(100);
      expect(result.recommendations).to.be.an('array');
    });
  });

  describe('stripTagsToText', () => {
    it('should extract text content from HTML', async () => {
      const html = '<div><h1>Title</h1><p>Content with <strong>bold</strong> text</p></div>';
      const text = await stripTagsToText(html);

      expect(text).to.include('Title');
      expect(text).to.include('Content with');
      expect(text).to.include('bold');
      expect(text).to.include('text');
      expect(text).to.not.include('<');
      expect(text).to.not.include('>');
    });

    it('should remove navigation elements when ignoreNavFooter is true', async () => {
      const html = '<html><body><nav>Navigation</nav><h1>Title</h1><p>Content</p><footer>Footer</footer></body></html>';
      const text = await stripTagsToText(html, true);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.not.include('Navigation');
      expect(text).to.not.include('Footer');
    });

    it('should keep navigation elements when ignoreNavFooter is false', async () => {
      const html = '<html><body><nav>Navigation</nav><h1>Title</h1><p>Content</p><footer>Footer</footer></body></html>';
      const text = await stripTagsToText(html, false);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.include('Navigation');
      expect(text).to.include('Footer');
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between identical texts', () => {
      const text = 'This is a test text';
      const similarity = calculateSimilarity(text, text);

      expect(similarity).to.equal(100);
    });

    it('should calculate similarity between different texts', () => {
      const text1 = 'This is a test';
      const text2 = 'This is another test';
      const similarity = calculateSimilarity(text1, text2);

      expect(similarity).to.be.greaterThan(0);
      expect(similarity).to.be.lessThan(100);
    });

    it('should return 0 for completely different texts', () => {
      const text1 = 'Hello world';
      const text2 = 'Goodbye universe';
      const similarity = calculateSimilarity(text1, text2);

      expect(similarity).to.equal(0);
    });
  });
});
