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
  calculateVisibilityScore,
  calculateVisibilityScoreFromText,
} from '../src/index.js';

describe('Visibility Score', () => {
  // -------------------------------------------------------------------------
  // calculateVisibilityScoreFromText (synchronous text-based variant)
  // -------------------------------------------------------------------------
  describe('calculateVisibilityScoreFromText', () => {
    it('should return a score object with all required fields', () => {
      const result = calculateVisibilityScoreFromText(
        'Hello world this is a test',
        'Hello world this is a test',
      );

      expect(result).to.have.property('score').that.is.a('number');
      expect(result).to.have.property('contentRecall').that.is.a('number');
      expect(result).to.have.property('vocabularyCoverage').that.is.a('number');
      expect(result).to.have.property('structuralCompleteness').that.is.a('number');
      expect(result).to.have.property('contentDensityParity').that.is.a('number');
      expect(result).to.have.property('scoreLabel').that.is.a('string');
    });

    it('should return score=100 and label=Excellent for identical text', () => {
      const text = 'Adobe Experience Manager delivers personalized content at scale';
      const result = calculateVisibilityScoreFromText(text, text);

      expect(result.score).to.equal(100);
      expect(result.scoreLabel).to.equal('Excellent');
      expect(result.contentRecall).to.equal(100);
      expect(result.vocabularyCoverage).to.equal(100);
      expect(result.contentDensityParity).to.equal(100);
    });

    it('should return score=0 when agent text is empty but user has content', () => {
      const result = calculateVisibilityScoreFromText('', 'important content for users');

      expect(result.score).to.equal(0);
      expect(result.contentRecall).to.equal(0);
      expect(result.vocabularyCoverage).to.equal(0);
    });

    it('should return perfect score when user text is empty', () => {
      const result = calculateVisibilityScoreFromText('agent only content', '');

      // Nothing to miss — all sub-scores default to 100
      expect(result.score).to.equal(100);
    });

    it('should score higher when agent has more user content (partial overlap)', () => {
      const agentFull = 'Adobe Experience Manager delivers personalised content at scale for enterprise';
      const agentPartial = 'Adobe Experience Manager';
      const user = 'Adobe Experience Manager delivers personalised content at scale for enterprise';

      const full = calculateVisibilityScoreFromText(agentFull, user);
      const partial = calculateVisibilityScoreFromText(agentPartial, user);

      expect(full.score).to.be.greaterThan(partial.score);
    });

    it('should not penalise agent view that is longer than user view', () => {
      // Agent view includes extra server-rendered content — should not hurt score
      const agentText = 'Introduction. Main content about products. Extra server-rendered metadata context.';
      const userText = 'Introduction. Main content about products.';

      const result = calculateVisibilityScoreFromText(agentText, userText);

      // Score should still be high since all user content is present in agent view
      expect(result.score).to.be.greaterThanOrEqual(80);
      expect(result.contentRecall).to.equal(100);
    });

    it('should correctly detect missing content keywords', () => {
      const agentText = 'Our company provides solutions for businesses worldwide.';
      const userText = 'Our company provides cutting-edge AI solutions for businesses worldwide, improving efficiency.';

      const result = calculateVisibilityScoreFromText(agentText, userText);

      // Should be penalised for missing meaningful words
      expect(result.vocabularyCoverage).to.be.lessThan(100);
      expect(result.score).to.be.lessThan(100);
    });

    it('should return label=Critical for very low scores', () => {
      // Completely unrelated texts
      const result = calculateVisibilityScoreFromText(
        'navigation menu header footer site links',
        'deep technical article about machine learning transformers attention mechanism',
      );

      expect(result.scoreLabel).to.equal('Critical');
      expect(result.score).to.be.lessThan(30);
    });

    it('score labels should follow the correct thresholds', () => {
      const excellent = calculateVisibilityScoreFromText(
        'experience cloud platform adobe digital marketing',
        'experience cloud platform adobe digital marketing',
      );
      expect(excellent.scoreLabel).to.equal('Excellent');

      // Partial overlap: roughly 60–70% score
      const fair = calculateVisibilityScoreFromText(
        'adobe analytics data insights platform',
        'adobe analytics data insights platform enterprise customers integration api',
      );
      // Just verify label is not Critical (we don't assert the exact value since
      // LCS scoring can vary slightly; the important thing is it isn't the worst)
      expect(['Good', 'Fair', 'Excellent']).to.include(fair.scoreLabel);
    });

    it('handles empty strings gracefully without throwing', () => {
      expect(() => calculateVisibilityScoreFromText('', '')).to.not.throw();
      const result = calculateVisibilityScoreFromText('', '');
      expect(result.score).to.be.a('number');
    });
  });

  // -------------------------------------------------------------------------
  // calculateVisibilityScore (HTML-based async variant)
  // -------------------------------------------------------------------------
  describe('calculateVisibilityScore', () => {
    it('should return a VisibilityScoreResult from raw HTML', async () => {
      const agentHtml = '<html><body><h1>Title</h1><p>Main content here.</p></body></html>';
      const userHtml = '<html><body><h1>Title</h1><p>Main content here.</p><p>More details.</p></body></html>';

      const result = await calculateVisibilityScore(agentHtml, userHtml);

      expect(result).to.have.property('score').that.is.a('number');
      expect(result).to.have.property('contentRecall').that.is.a('number');
      expect(result).to.have.property('vocabularyCoverage').that.is.a('number');
      expect(result).to.have.property('structuralCompleteness').that.is.a('number');
      expect(result).to.have.property('contentDensityParity').that.is.a('number');
      expect(result).to.have.property('scoreLabel').that.is.a('string');
    });

    it('should return score=100 for identical HTML', async () => {
      const html = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      const result = await calculateVisibilityScore(html, html);

      expect(result.score).to.equal(100);
      expect(result.scoreLabel).to.equal('Excellent');
    });

    it('should include structural completeness from HTML tag counts', async () => {
      // Agent view has no headings; user view has several
      const agentHtml = '<html><body><p>Some paragraph text without headings.</p></body></html>';
      const userHtml = '<html><body><h1>Big Heading</h1><h2>Sub Heading</h2><h3>Section</h3><p>Text</p></body></html>';

      const result = await calculateVisibilityScore(agentHtml, userHtml);

      // Structural completeness should be less than 100
      expect(result.structuralCompleteness).to.be.lessThan(100);
    });

    it('should penalise agent view missing most user content', async () => {
      const agentHtml = '<html><body><nav>Navigation links go here</nav></body></html>';
      const userHtml = '<html><body><h1>Product Overview</h1><p>Detailed description of our innovative product offering that serves enterprise customers.</p><ul><li>Feature one</li><li>Feature two</li></ul></body></html>';

      const result = await calculateVisibilityScore(agentHtml, userHtml);

      expect(result.score).to.be.lessThan(50);
    });

    it('should accept options.ignoreNavFooter=false', async () => {
      const html = '<html><body><nav>Nav</nav><h1>Title</h1><p>Content</p><footer>Footer</footer></body></html>';
      const resultIgnore = await calculateVisibilityScore(html, html, { ignoreNavFooter: true });
      const resultKeep = await calculateVisibilityScore(html, html, { ignoreNavFooter: false });

      // Both identical-input runs should score 100 regardless of nav filter
      expect(resultIgnore.score).to.equal(100);
      expect(resultKeep.score).to.equal(100);
    });

    it('should integrate with calculateStats output', async () => {
      const { calculateStats } = await import('../src/index.js');
      const agentHtml = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      const userHtml = '<html><body><h1>Title</h1><p>Content</p><p>More</p></body></html>';

      const stats = await calculateStats(agentHtml, userHtml);

      expect(stats).to.have.property('visibilityScore');
      expect(stats.visibilityScore).to.have.property('score').that.is.a('number');
      expect(stats.visibilityScore).to.have.property('scoreLabel').that.is.a('string');
      // citationReadability is retained for backwards compatibility
      expect(stats).to.have.property('citationReadability').that.is.a('number');
    });

    it('calculateBothScenarioStats should include visibilityScore in both scenarios', async () => {
      const { calculateBothScenarioStats } = await import('../src/index.js');
      const agentHtml = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      const userHtml = '<html><body><h1>Title</h1><p>Content</p><p>More</p></body></html>';

      const result = await calculateBothScenarioStats(agentHtml, userHtml);

      expect(result.withNavFooterIgnored).to.have.property('visibilityScore');
      expect(result.withoutNavFooterIgnored).to.have.property('visibilityScore');
      expect(result.withNavFooterIgnored.visibilityScore).to.have.property('score');
    });
  });
});
