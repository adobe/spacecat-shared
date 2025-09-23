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
 * HTML Visibility Analyzer TypeScript Definitions
 */

/** UTILITY FUNCTIONS */

/**
 * Generate DJB2 hash for content comparison
 */
export function hashDJB2(str: string): string;

/**
 * Format percentage with 1 decimal place
 */
export function pct(n: number): string;

/**
 * Format number to K/M format for readability
 */
export function formatNumberToK(num: number): string;

/**
 * Check if code is running in browser environment
 */
export function isBrowser(): boolean;


/** TOKENIZATION FUNCTIONS */

/**
 * Tokenizes text into words or lines with intelligent normalization
 */
export function tokenize(text: string, mode?: "word" | "line"): string[];

/**
 * Normalize text for consistent comparison
 */
export function normalizeText(text: string): string;

/**
 * Count words in text using tokenization
 */
export function countWords(text: string): number;

/**
 * Count lines in text using tokenization
 */
export function countLines(text: string): number;

/** DIFF ENGINE FUNCTIONS */

interface DiffOperation {
  type: "same" | "add" | "del";
  text: string;
}

interface DiffReport {
  addCount: number;
  delCount: number;
  sameCount: number;
  diffOps: DiffOperation[];
  summary: string;
}

// HtmlDiff interface removed - was unused

/**
 * Generate LCS-based diff between two strings
 */
export function diffTokens(aStr: string, bStr: string, mode?: "word" | "line"): DiffOperation[];

/**
 * Generate comprehensive diff report with statistics
 */
export function generateDiffReport(initText: string, finText: string, mode?: "word" | "line"): DiffReport;


// generateHtmlDiff() removed - was unused

/** HTML FILTERING FUNCTIONS */

/**
 * Filter HTML content by removing unwanted elements
 */
export function filterHtmlContent(htmlContent: string, ignoreNavFooter?: boolean, returnText?: boolean): Promise<string>;

/**
 * Extract plain text from HTML content
 */
export function stripTagsToText(htmlContent: string, ignoreNavFooter?: boolean): Promise<string>;

/**
 * Extract word count from HTML content
 */
export function extractWordCount(htmlContent: string, ignoreNavFooter?: boolean): Promise<{ word_count: number }>;

/**
 * Remove navigation and footer elements from DOM element (browser environment)
 * For Chrome extension DOM manipulation use cases
 * Optimized: single DOM query instead of 35 separate queries (35x performance improvement)
 */
export function filterNavigationAndFooterBrowser(element: Element): void;

/** ANALYSIS FUNCTIONS (Original Chrome Extension Logic) */

interface TextComparison {
  initialText: string;
  finalText: string;
  initialTextLength: number;
  finalTextLength: number;
  textRetention: number;
  textRetentionPercent: string;
  wordDiff: DiffReport;
  lineDiff: DiffReport;
  initialTextHash: string;
  finalTextHash: string;
}

interface BasicStats {
  wordDiff: number;
  contentIncreaseRatio: number;
  citationReadability: number;
}

interface ScenarioStats {
  wordDiff: number;
  contentIncreaseRatio: number;
  citationReadability: number;
  contentGain: string;
  missingWords: number;
}

interface BothScenariosStats {
  withNavFooterIgnored: ScenarioStats;
  withoutNavFooterIgnored: ScenarioStats;
}


/**
 * Comprehensive text-only analysis between initial and final HTML (original chrome extension logic)
 */
export function analyzeTextComparison(
  initHtml: string, 
  finHtml: string, 
  ignoreNavFooter?: boolean
): Promise<TextComparison>;

/**
 * Calculate basic stats from HTML comparison (original chrome extension logic)
 */
export function calculateStats(
  originalHTML: string, 
  currentHTML: string, 
  ignoreNavFooter?: boolean
): Promise<BasicStats>;

/**
 * Calculate stats for both nav/footer scenarios (original chrome extension logic)
 */
export function calculateBothScenarioStats(
  originalHTML: string, 
  currentHTML: string
): Promise<BothScenariosStats>;

