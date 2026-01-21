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

/**
 * Content analysis and metrics calculation
 * Provides comprehensive analysis of HTML content differences
 */

import { stripTagsToText } from './html-filter.js';
import { tokenize } from './tokenizer.js';
import { generateDiffReport } from './diff-engine.js';
import { hashDJB2, pct } from './utils.js';

/**
 * Comprehensive text-only analysis between initial and final HTML
 * @param {string} initHtml - Initial HTML content (what crawlers see)
 * @param {string} finHtml - Final HTML content (what users see)
 * @param {boolean} [ignoreNavFooter=true] - Whether to ignore navigation/footer elements
 * @returns {Promise<Object>} Comprehensive analysis results
 */
export async function analyzeTextComparison(initHtml, finHtml, ignoreNavFooter = true) {
  // Handle both sync (browser) and async (Node.js) stripTagsToText
  const initTextResult = stripTagsToText(initHtml, ignoreNavFooter, true);
  const finTextResult = stripTagsToText(finHtml, ignoreNavFooter, false);

  const initText = await Promise.resolve(initTextResult);
  const finText = await Promise.resolve(finTextResult);

  const initTextLength = initText.length;
  const finTextLength = finText.length;
  const textRetention = finTextLength > 0 ? initTextLength / finTextLength : 0;

  const wordDiff = generateDiffReport(initText, finText, 'word');
  const lineDiff = generateDiffReport(initText, finText, 'line');

  return {
    initialText: initText,
    finalText: finText,
    initialTextLength: initTextLength,
    finalTextLength: finTextLength,
    textRetention,
    textRetentionPercent: pct(textRetention),
    wordDiff,
    lineDiff,
    initialTextHash: hashDJB2(initText),
    finalTextHash: hashDJB2(finText),
  };
}

/**
 * Calculate basic stats from HTML comparison
 * @param {string} originalHTML - Initial HTML content
 * @param {string} currentHTML - Final HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to ignore navigation/footer elements
 * @returns {Promise<Object>} Basic statistics
 */
export async function calculateStats(originalHTML, currentHTML, ignoreNavFooter = true) {
  // Handle both sync (browser) and async (Node.js) stripTagsToText
  const originalTextResult = stripTagsToText(originalHTML, ignoreNavFooter, true);
  const currentTextResult = stripTagsToText(currentHTML, ignoreNavFooter, false);

  const originalText = await Promise.resolve(originalTextResult);
  const currentText = await Promise.resolve(currentTextResult);

  // Calculate word counts using consistent tokenization
  const originalTokens = tokenize(originalText, 'word');
  const currentTokens = tokenize(currentText, 'word');
  const wordCountBefore = originalTokens.length;
  const wordCountAfter = currentTokens.length;
  const wordDiff = Math.abs(wordCountAfter - wordCountBefore);

  // Calculate content increase ratio (how many times content increased)
  let contentIncreaseRatio;
  if (originalTokens.length > 0) {
    contentIncreaseRatio = currentTokens.length / originalTokens.length;
  } else {
    contentIncreaseRatio = currentTokens.length > 0 ? currentTokens.length : 1;
  }

  // Calculate citation readability (percentage of original content available in current)
  const citationReadability = currentTokens.length > 0
    ? Math.min(100, (originalTokens.length / currentTokens.length) * 100) : 100;

  return {
    wordCountBefore,
    wordCountAfter,
    wordDiff,
    contentIncreaseRatio: Math.round(contentIncreaseRatio * 100) / 100, // Round to 1 decimal place
    citationReadability: Math.round(citationReadability),
  };
}

/**
 * Calculate stats for both nav/footer scenarios
 * @param {string} originalHTML - Initial HTML content
 * @param {string} currentHTML - Final HTML content
 * @returns {Promise<Object>} Analysis results for both scenarios
 */
export async function calculateBothScenarioStats(originalHTML, currentHTML) {
  // Calculate stats with nav/footer ignored
  const statsIgnored = await calculateStats(originalHTML, currentHTML, true);

  // Calculate stats without nav/footer ignored
  const statsNotIgnored = await calculateStats(originalHTML, currentHTML, false);
  return {
    withNavFooterIgnored: {
      wordCountBefore: statsIgnored.wordCountBefore,
      wordCountAfter: statsIgnored.wordCountAfter,
      wordDiff: statsIgnored.wordDiff,
      contentIncreaseRatio: statsIgnored.contentIncreaseRatio,
      citationReadability: statsIgnored.citationReadability,
      contentGain: `${Math.round(statsIgnored.contentIncreaseRatio * 10) / 10}x`,
      missingWords: statsIgnored.wordDiff,
    },
    withoutNavFooterIgnored: {
      wordCountBefore: statsNotIgnored.wordCountBefore,
      wordCountAfter: statsNotIgnored.wordCountAfter,
      wordDiff: statsNotIgnored.wordDiff,
      contentIncreaseRatio: statsNotIgnored.contentIncreaseRatio,
      citationReadability: statsNotIgnored.citationReadability,
      contentGain: `${Math.round(statsNotIgnored.contentIncreaseRatio * 10) / 10}x`,
      missingWords: statsNotIgnored.wordDiff,
    },
  };
}
