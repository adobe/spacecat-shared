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

    it('should include noscript in initial HTML and exclude in final HTML by default', async () => {
      const initHtml = '<html><body><h1>Title</h1><noscript>Enable JS</noscript><p>Content</p></body></html>';
      const finHtml = '<html><body><h1>Title</h1><noscript>Enable JS</noscript><p>Content</p><div>Extra</div></body></html>';
      const result = await analyzeTextComparison(initHtml, finHtml);

      // Initial text should include noscript content
      expect(result.initialText).to.include('Enable JS');
      // Final text should NOT include noscript content by default
      expect(result.finalText).to.not.include('Enable JS');
      // Both should have the main content
      expect(result.initialText).to.include('Title');
      expect(result.finalText).to.include('Title');
    });

    it('should include noscript in final HTML when includeNoscriptInFinal is true', async () => {
      const initHtml = '<html><body><h1>Title</h1><noscript>Enable JS</noscript><p>Content</p></body></html>';
      const finHtml = '<html><body><h1>Title</h1><noscript>Enable JS</noscript><p>Content</p><div>Extra</div></body></html>';
      const result = await analyzeTextComparison(initHtml, finHtml, true, true);

      // Initial text should include noscript content
      expect(result.initialText).to.include('Enable JS');
      // Final text should ALSO include noscript content when flag is true
      expect(result.finalText).to.include('Enable JS');
      // Both should have the main content
      expect(result.initialText).to.include('Title');
      expect(result.finalText).to.include('Title');
      expect(result.finalText).to.include('Extra');
    });
  });

  describe('calculateStats', () => {
    it('should provide basic comparison statistics', async () => {
      const result = await calculateStats(simpleHtml, richHtml);

      expect(result).to.have.property('wordCountBefore');
      expect(result).to.have.property('wordCountAfter');
      expect(result).to.have.property('wordDiff');
      expect(result).to.have.property('contentIncreaseRatio');
      expect(result).to.have.property('citationReadability');

      expect(result.wordCountBefore).to.be.a('number');
      expect(result.wordCountAfter).to.be.a('number');
      expect(result.wordDiff).to.be.a('number');
      expect(result.contentIncreaseRatio).to.be.a('number');
      expect(result.citationReadability).to.be.a('number');
    });

    it('should handle noscript elements correctly in word counts by default', async () => {
      const originalHtml = '<html><body><h1>Title</h1><noscript>Enable JavaScript</noscript><p>Original content</p></body></html>';
      const currentHtml = '<html><body><h1>Title</h1><noscript>Enable JavaScript</noscript><p>Original content</p><p>New content</p></body></html>';
      const result = await calculateStats(originalHtml, currentHtml);

      // Word counts should reflect the includeNoscript behavior
      // originalText includes noscript (includeNoscript=true):
      //     "Title Enable JavaScript Original content"
      // currentText excludes noscript (includeNoscript=false):
      //     "Title Original content New content"
      expect(result.wordCountBefore).to.be.greaterThan(0);
      expect(result.wordCountAfter).to.be.greaterThan(0);
      expect(result.contentIncreaseRatio).to.be.a('number');
    });

    it('should include noscript in current HTML when includeNoscriptInCurrent is true', async () => {
      const originalHtml = '<html><body><h1>Title</h1><noscript>Enable JavaScript</noscript><p>Original content</p></body></html>';
      const currentHtml = '<html><body><h1>Title</h1><noscript>Enable JavaScript</noscript><p>Original content</p><p>New content</p></body></html>';
      const resultWithout = await calculateStats(originalHtml, currentHtml, true, false);
      const resultWith = await calculateStats(originalHtml, currentHtml, true, true);

      // When noscript is excluded from current, word count should be lower
      expect(resultWithout.wordCountAfter).to.be.lessThan(resultWith.wordCountAfter);

      // Note: Text extraction concatenates without spaces, so words merge
      // originalHtml with noscript: "TitleEnable JavaScriptOriginal content" = 3 words
      // originalHtml without noscript: "TitleOriginal content" = 2 words
      // currentHtml without noscript: "TitleOriginal contentNew content" = 3 words
      // currentHtml with noscript: "TitleEnable JavaScriptOriginal contentNew content" = 4 words
      expect(resultWithout.wordCountBefore).to.equal(3);
      expect(resultWithout.wordCountAfter).to.equal(3);
      expect(resultWith.wordCountBefore).to.equal(3);
      expect(resultWith.wordCountAfter).to.equal(4);
    });
  });

  describe('calculateBothScenarioStats', () => {
    it('should provide statistics for both scenarios', async () => {
      const result = await calculateBothScenarioStats(simpleHtml, richHtml);

      expect(result).to.have.property('withNavFooterIgnored');
      expect(result).to.have.property('withoutNavFooterIgnored');

      // Verify withNavFooterIgnored has all required properties
      expect(result.withNavFooterIgnored).to.have.property('wordCountBefore');
      expect(result.withNavFooterIgnored).to.have.property('wordCountAfter');
      expect(result.withNavFooterIgnored).to.have.property('contentGain');
      expect(result.withNavFooterIgnored).to.have.property('missingWords');

      // Verify withoutNavFooterIgnored has all required properties
      expect(result.withoutNavFooterIgnored).to.have.property('wordCountBefore');
      expect(result.withoutNavFooterIgnored).to.have.property('wordCountAfter');
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

    it('should remove accessibility widget elements', async () => {
      const html = `<html><body>
        <h1>Title</h1>
        <div id="digiAccess">Accessibility Widget</div>
        <div id="dAopener">Accessibility Opener</div>
        <div class="da-opener-123">Accessibility Class Opener</div>
        <p>Content</p>
      </body></html>`;

      const text = await stripTagsToText(html, true);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.not.include('Accessibility Widget');
      expect(text).to.not.include('Accessibility Opener');
      expect(text).to.not.include('Accessibility Class Opener');
    });

    it('should remove cookie banner when selector matches and content indicates consent', async () => {
      const html = `<html><body>
        <h1>Title</h1>
        <div id="onetrust-consent-sdk">We use cookies. Manage consent preferences.</div>
        <p>Content</p>
      </body></html>`;

      const text = await stripTagsToText(html, true);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.not.include('We use cookies');
      expect(text).to.not.include('Manage consent preferences');
    });

    it('should not remove cookie-banner selectors when content does not indicate consent', async () => {
      const html = `<html><body>
        <h1>Title</h1>
        <div id="onetrust-consent-sdk">Just a container with neutral text.</div>
        <p>Content</p>
      </body></html>`;

      const text = await stripTagsToText(html, true);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.include('Just a container with neutral text.');
    });

    it('should remove noscript elements by default', async () => {
      const html = '<html><body><h1>Title</h1><noscript>Please enable JavaScript</noscript><p>Content</p></body></html>';
      const text = await stripTagsToText(html);

      expect(text).to.include('Title');
      expect(text).to.include('Content');
      expect(text).to.not.include('Please enable JavaScript');
      expect(text).to.not.include('noscript');
    });

    it('should remove noscript elements when includeNoscript is false', async () => {
      const html = '<html><body><h1>Title</h1><noscript>Noscript content</noscript><p>Regular content</p></body></html>';
      const text = await stripTagsToText(html, true, false);

      expect(text).to.include('Title');
      expect(text).to.include('Regular content');
      expect(text).to.not.include('Noscript content');
    });

    it('should keep noscript elements when includeNoscript is true', async () => {
      const html = '<html><body><h1>Title</h1><noscript>Noscript fallback</noscript><p>Regular content</p></body></html>';
      const text = await stripTagsToText(html, true, true);

      expect(text).to.include('Title');
      expect(text).to.include('Regular content');
      expect(text).to.include('Noscript fallback');
    });

    it('should handle multiple noscript elements with includeNoscript', async () => {
      const html = `<html><body>
        <h1>Title</h1>
        <noscript>First noscript</noscript>
        <p>Content</p>
        <noscript>Second noscript</noscript>
      </body></html>`;

      const textWithout = await stripTagsToText(html, true, false);
      const textWith = await stripTagsToText(html, true, true);

      expect(textWithout).to.include('Title');
      expect(textWithout).to.include('Content');
      expect(textWithout).to.not.include('First noscript');
      expect(textWithout).to.not.include('Second noscript');

      expect(textWith).to.include('Title');
      expect(textWith).to.include('Content');
      expect(textWith).to.include('First noscript');
      expect(textWith).to.include('Second noscript');
    });
  });
});
