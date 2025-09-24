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
 * Browser Entry Point for Chrome Extension
 * Exposes all necessary functions for Chrome extension usage
 *
 * This bundle excludes Node.js specific code (cheerio) and creates
 * a browser-compatible version for Chrome extensions.
 */

// Import only browser-compatible functions
import {
  analyzeTextComparison,
  calculateStats,
  calculateBothScenarioStats,
  stripTagsToText,
  filterHtmlContent,
  extractWordCount,
  filterNavigationAndFooterBrowser,
  tokenize,
  countWords,
  countLines,
  diffTokens,
  generateDiffReport,
  hashDJB2,
  pct,
  formatNumberToK,
  isBrowser,
} from './index.js';

// Create global object for Chrome extension
const HTMLAnalyzer = {
  // Core analysis functions (matching Chrome extension API)
  analyzeTextComparison,
  calculateStats,
  calculateBothScenarioStats,

  // HTML processing functions
  stripTagsToText,
  filterHtmlContent,
  extractWordCount,
  filterNavigationAndFooterBrowser,

  // Text processing functions
  tokenize,
  countWords,
  countLines,

  // Diff engine functions
  diffTokens,
  generateDiffReport,

  // Utility functions
  hashDJB2,
  pct,
  formatNumberToK,
  isBrowser,

  // Version info
  version: '1.0.0',
  buildFor: 'chrome-extension',
};

// Make available globally for Chrome extension script tags
// This needs to be executed immediately when the bundle loads
/* eslint-env browser */
/* global window, self */
(function setGlobal() {
  // Determine the global object (works in browser, Node.js, Web Workers)
  const globalObject = (function getGlobalObject() {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof self !== 'undefined') return self;
    return this || {};
  }());

  // Assign to global scope
  globalObject.HTMLAnalyzer = HTMLAnalyzer;
}());

// Export for ES modules
export default HTMLAnalyzer;
