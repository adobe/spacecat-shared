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
 * HTML Visibility Analyzer - Main Entry Point
 * Analyze HTML content visibility for AI crawlers and citations
 * Compatible with both Node.js and browser environments (including Chrome extensions)
 */

// Import functions for internal use
import { stripTagsToText } from './html-filter.js';
import { countWords } from './tokenizer.js';
import { calculateSimilarity } from './diff-engine.js';

export {
  filterHtmlContent,
  stripTagsToText,
  extractWordCount,
} from './html-filter.js';

export {
  tokenize,
  normalizeText,
  countWords,
  countLines,
} from './tokenizer.js';

export {
  diffTokens,
  generateDiffReport,
  calculateSimilarity,
  generateHtmlDiff,
} from './diff-engine.js';

export {
  analyzeTextComparison,
  calculateStats,
  calculateBothScenarioStats,
} from './analyzer.js';

export {
  hashDJB2,
  pct,
  formatNumberToK,
  isBrowser,
  isNode,
  safeJsonParse,
  debounce,
  throttle,
} from './utils.js';

// analyzeVisibility() removed - use analyzeTextComparison() directly

/**
 * Compare two HTML contents and get quick metrics
 * @param {string} html1 - First HTML content
 * @param {string} html2 - Second HTML content
 * @param {Object} [options={}] - Comparison options
 * @param {boolean} [options.ignoreNavFooter=true] - Ignore navigation/footer elements
 * @returns {Promise<Object>} Quick comparison metrics
 */
export async function quickCompare(html1, html2, options = {}) {
  const { ignoreNavFooter = true } = options;

  // Handle both sync (browser) and async (Node.js) stripTagsToText
  const text1Result = stripTagsToText(html1, ignoreNavFooter);
  const text2Result = stripTagsToText(html2, ignoreNavFooter);

  const text1 = await Promise.resolve(text1Result);
  const text2 = await Promise.resolve(text2Result);

  const words1 = countWords(text1);
  const words2 = countWords(text2);

  const similarity = calculateSimilarity(text1, text2);
  const contentGain = words1 > 0 ? words2 / words1 : 1;
  const missingWords = Math.abs(words2 - words1);

  return {
    wordCount: {
      first: words1,
      second: words2,
      difference: words2 - words1,
    },
    contentGain: Math.round(contentGain * 10) / 10,
    missingWords,
    similarity: Math.round(similarity * 10) / 10,
  };
}

// getComparisonStats() removed - use calculateStats() directly
// getBothScenarioStats() removed - use calculateBothScenarioStats() directly
