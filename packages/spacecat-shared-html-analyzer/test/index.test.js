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
  analyzeTextComparison,
  calculateStats,
  calculateBothScenarioStats,
  stripTagsToText,
} from '../src/index.js';

describe('HTML Visibility Analyzer', () => {
  const simpleHtml = '<html><body><h1>Title</h1><p>Content here</p></body></html>';
  const richHtml = '<html><body><h1>Title</h1><p>Content here</p><script>console.log("loaded")</script><div class="dynamic">Dynamic content</div></body></html>';

  describe('analyzeTextComparison', () => {
    it('should analyze content differences', async () => {
      const result = await analyzeTextComparison(simpleHtml, richHtml);

      expect(result).to.have.property('initialText');
      expect(result).to.have.property('finalText');
      expect(result).to.have.property('textRetention');
      expect(result).to.have.property('wordDiff');
      expect(result).to.have.property('lineDiff');
    });

    it('should handle identical content', async () => {
      const result = await analyzeTextComparison(simpleHtml, simpleHtml);

      expect(result.textRetention).to.equal(1);
      expect(result.initialText).to.equal(result.finalText);
    });

    it('should handle empty content', async () => {
      const result = await analyzeTextComparison('', richHtml);

      expect(result.initialText).to.equal('');
      expect(result.finalText.length).to.be.greaterThan(0);
    });
  });

  describe('calculateStats', () => {
    it('should provide basic comparison statistics', async () => {
      const result = await calculateStats(simpleHtml, richHtml);

      expect(result).to.have.property('wordDiff');
      expect(result).to.have.property('contentIncreaseRatio');
      expect(result).to.have.property('citationReadability');

      expect(result.wordDiff).to.be.a('number');
      expect(result.contentIncreaseRatio).to.be.a('number');
      expect(result.citationReadability).to.be.a('number');
    });
  });

  describe('calculateBothScenarioStats', () => {
    it('should provide statistics for both scenarios', async () => {
      const result = await calculateBothScenarioStats(simpleHtml, richHtml);

      expect(result).to.have.property('withNavFooterIgnored');
      expect(result).to.have.property('withoutNavFooterIgnored');
      expect(result.withNavFooterIgnored).to.have.property('contentGain');
      expect(result.withoutNavFooterIgnored).to.have.property('missingWords');
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
});
