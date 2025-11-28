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

export {
  filterHtmlContent,
  stripTagsToText,
  extractWordCount,
  filterNavigationAndFooterBrowser,
} from './html-filter.js';

export {
  tokenize,
  countWords,
  countLines,
} from './tokenizer.js';

export {
  diffTokens,
  generateDiffReport,
} from './diff-engine.js';

export {
  analyzeTextComparison,
  calculateStats,
  calculateBothScenarioStats,
} from './analyzer.js';

export {
  htmlToMarkdown,
  markdownToHtml,
  htmlToMarkdownToHtml,
} from './markdown-converter.js';

export {
  diffDOMBlocks,
  createMarkdownTableDiff,
  generateMarkdownDiff,
  htmlToRenderedMarkdown,
} from './markdown-diff.js';

export {
  hashDJB2,
  pct,
  formatNumberToK,
  isBrowser,
  getGlobalObject,
} from './utils.js';
