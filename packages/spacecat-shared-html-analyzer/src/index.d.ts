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

/**
 * Generate LCS-based diff between two strings
 */
export function diffTokens(aStr: string, bStr: string, mode?: "word" | "line"): DiffOperation[];

/**
 * Generate comprehensive diff report with statistics
 */
export function generateDiffReport(initText: string, finText: string, mode?: "word" | "line"): DiffReport;


/** HTML FILTERING FUNCTIONS */

/**
 * Filter HTML content by removing unwanted elements
 */
export function filterHtmlContent(
  htmlContent: string, 
  ignoreNavFooter?: boolean, 
  returnText?: boolean, 
  includeNoscript?: boolean
): Promise<string>;

/**
 * Extract plain text from HTML content
 */
export function stripTagsToText(
  htmlContent: string, 
  ignoreNavFooter?: boolean, 
  includeNoscript?: boolean
): Promise<string>;

/**
 * Extract word count from HTML content
 */
export function extractWordCount(
  htmlContent: string, 
  ignoreNavFooter?: boolean, 
  includeNoscript?: boolean
): Promise<{ word_count: number }>;

/**
 * Remove navigation and footer elements from DOM element (browser environment)
 * For Chrome extension DOM manipulation use cases
 * Optimized: single DOM query instead of 35 separate queries (35x performance improvement)
 */
export function filterNavigationAndFooterBrowser(element: Element): void;

/** VISIBILITY SCORE FUNCTIONS */

/**
 * Result of a visibility score calculation.
 */
export interface VisibilityScoreResult {
  /** Composite visibility score (0–100). Higher is better. */
  score: number;
  /**
   * LCS-based fraction of user-visible tokens present in the agent view (0–100).
   * Weight: 40 %.
   */
  contentRecall: number;
  /**
   * Fraction of unique meaningful user terms found in the agent view (0–100).
   * Weight: 30 %.
   */
  vocabularyCoverage: number;
  /**
   * Fraction of structural HTML elements (headings, lists, etc.) preserved
   * in the agent view relative to the user view (0–100). Weight: 15 %.
   */
  structuralCompleteness: number;
  /**
   * Similarity of meaningful-word density between agent and user views (0–100).
   * Weight: 15 %.
   */
  contentDensityParity: number;
  /** Human-readable label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'. */
  scoreLabel: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
}

export interface VisibilityScoreOptions {
  /** Strip nav/footer before scoring (default: true). */
  ignoreNavFooter?: boolean;
  /** Include noscript elements in agent text extraction (default: false). */
  includeNoscript?: boolean;
}

/**
 * Calculate an improved, multi-dimensional Visibility Score from raw HTML.
 *
 * Compares the "agent view" (initial / server-side HTML) against the
 * "user view" (final / client-side HTML).  Asynchronous because text
 * extraction uses cheerio in Node.js environments.
 */
export function calculateVisibilityScore(
  agentHtml: string,
  userHtml: string,
  options?: VisibilityScoreOptions
): Promise<VisibilityScoreResult>;

/**
 * Calculate an improved, multi-dimensional Visibility Score from pre-extracted
 * plain text.  Synchronous — works in both browser and Node.js.
 *
 * Note: structuralCompleteness is always 100 in this variant because raw HTML
 * is not available for tag counting.
 */
export function calculateVisibilityScoreFromText(
  agentText: string,
  userText: string
): VisibilityScoreResult;

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
  /** Improved composite visibility score. */
  visibilityScore: VisibilityScoreResult;
}

interface BasicStats {
  wordCountBefore: number;
  wordCountAfter: number;
  wordDiff: number;
  contentIncreaseRatio: number;
  /** @deprecated Use visibilityScore.score for a more accurate measurement. */
  citationReadability: number;
  /** Improved composite visibility score. */
  visibilityScore: VisibilityScoreResult;
}

interface ScenarioStats {
  wordCountBefore: number;
  wordCountAfter: number;
  wordDiff: number;
  contentIncreaseRatio: number;
  /** @deprecated Use visibilityScore.score for a more accurate measurement. */
  citationReadability: number;
  /** Improved composite visibility score. */
  visibilityScore: VisibilityScoreResult;
  contentGain: string;
  missingWords: number;
}

interface BothScenariosStats {
  withNavFooterIgnored: ScenarioStats;
  withoutNavFooterIgnored: ScenarioStats;
}


/**
 * Comprehensive text-only analysis between initial and final HTML (original chrome extension logic)
 * @param initHtml - Initial HTML content (what crawlers/bots see - server-side rendered)
 * @param finHtml - Final HTML content (what users see - client-side rendered)
 * @param ignoreNavFooter - Whether to ignore navigation/footer elements
 * @param includeNoscriptInFinal - Whether to include noscript content in final HTML (client-side)
 */
export function analyzeTextComparison(
  initHtml: string, 
  finHtml: string, 
  ignoreNavFooter?: boolean,
  includeNoscriptInFinal?: boolean
): Promise<TextComparison>;

/**
 * Calculate basic stats from HTML comparison (original chrome extension logic)
 * @param originalHTML - Initial HTML content (server-side)
 * @param currentHTML - Final HTML content (client-side)
 * @param ignoreNavFooter - Whether to ignore navigation/footer elements
 * @param includeNoscriptInCurrent - Whether to include noscript content in current HTML (client-side)
 */
export function calculateStats(
  originalHTML: string, 
  currentHTML: string, 
  ignoreNavFooter?: boolean,
  includeNoscriptInCurrent?: boolean
): Promise<BasicStats>;

/**
 * Calculate stats for both nav/footer scenarios (original chrome extension logic)
 * @param originalHTML - Initial HTML content (server-side)
 * @param currentHTML - Final HTML content (client-side)
 * @param includeNoscriptInCurrent - Whether to include noscript content in current HTML (client-side)
 */
export function calculateBothScenarioStats(
  originalHTML: string, 
  currentHTML: string,
  includeNoscriptInCurrent?: boolean
): Promise<BothScenariosStats>;

/** MARKDOWN DIFF FUNCTIONS */
interface MarkdownDiffBlock {
  html: string;
  text: string;
  tagName: string;
}

interface MarkdownDiffOperation {
  type: "same" | "add" | "del";
  originalBlock?: MarkdownDiffBlock;
  currentBlock?: MarkdownDiffBlock;
}

/**
 * Diff DOM blocks using LCS algorithm
 */
export function diffDOMBlocks(
  originalBlocks: MarkdownDiffBlock[],
  currentBlocks: MarkdownDiffBlock[]
): MarkdownDiffOperation[];

/**
 * Create markdown table diff from parsed DOM children
 */
export function createMarkdownTableDiff(
  originalChildren: Element[],
  currentChildren: Element[],
  $?: unknown
): { tableHtml: string; counters: string };

/**
 * Convert HTML to rendered markdown HTML (for display)
 */
export function htmlToRenderedMarkdown(
  html: string,
  ignoreNavFooter?: boolean
): Promise<string>;

/**
 * Generate complete markdown diff with HTML to Markdown conversion
 */
export function generateMarkdownDiff(
  originalHtml: string,
  currentHtml: string,
  ignoreNavFooter?: boolean
): Promise<{ originalRenderedHtml: string; currentRenderedHtml: string }>;
