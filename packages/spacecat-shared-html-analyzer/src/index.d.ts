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

/**
 * Check if code is running in Node.js environment
 */
export function isNode(): boolean;

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse(str: string, fallback?: any): any;

/**
 * Debounce function calls
 */
export function debounce(func: Function, wait: number): Function;

/**
 * Throttle function calls
 */
export function throttle(func: Function, limit: number): Function;

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

interface HtmlDiff {
  leftHtml: string;
  rightHtml: string;
}

/**
 * Generate LCS-based diff between two strings
 */
export function diffTokens(aStr: string, bStr: string, mode?: "word" | "line"): DiffOperation[];

/**
 * Generate comprehensive diff report with statistics
 */
export function generateDiffReport(initText: string, finText: string, mode?: "word" | "line"): DiffReport;

/**
 * Calculate similarity percentage between two texts
 */
export function calculateSimilarity(text1: string, text2: string, mode?: "word" | "line"): number;

/**
 * Generate HTML diff visualization
 */
export function generateHtmlDiff(diffOps: DiffOperation[], mode?: "word" | "line"): HtmlDiff;

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

/** ANALYSIS FUNCTIONS */

interface WordCount {
  initial: number;
  final: number;
  difference: number;
}

interface AnalysisMetrics {
  contentGain: number;
  contentGainFormatted: string;
  missingWords: number;
  missingWordsFormatted: string;
  citationReadability: number;
  similarity: number;
  wordCount: WordCount;
}

interface VisibilityScore {
  score: number;
  category: "excellent" | "good" | "fair" | "poor";
  description: string;
  breakdown?: {
    citationReadability: number;
    similarity: number;
    contentGain: number;
  };
}

interface ContentAnalysis {
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
  metrics: AnalysisMetrics;
  visibilityScore?: VisibilityScore;
}

interface AnalysisOptions {
  ignoreNavFooter?: boolean;
  includeScore?: boolean;
}

interface QuickCompareOptions {
  ignoreNavFooter?: boolean;
}

interface QuickCompareResult {
  wordCount: {
    first: number;
    second: number;
    difference: number;
  };
  contentGain: number;
  missingWords: number;
  similarity: number;
}

interface CitationReadinessResult {
  score: number;
  category: string;
  description: string;
  metrics: {
    citationReadability: number;
    contentGain: number;
    missingWords: number;
    similarity: number;
  };
  recommendations: string[];
}

interface BothScenariosResult {
  withNavFooterIgnored: AnalysisMetrics & { fullAnalysis: ContentAnalysis };
  withoutNavFooterIgnored: AnalysisMetrics & { fullAnalysis: ContentAnalysis };
}

/**
 * Comprehensive analysis between initial and final HTML content
 */
export function analyzeContentDifference(
  initHtml: string, 
  finHtml: string, 
  options?: { ignoreNavFooter?: boolean }
): Promise<ContentAnalysis>;

/**
 * Calculate citation readability score (how well AI can cite the content)
 */
export function calculateCitationReadability(initialWordCount: number, finalWordCount: number): number;

/**
 * Analyze both scenarios: with and without navigation/footer filtering
 */
export function analyzeBothScenarios(initHtml: string, finHtml: string): Promise<BothScenariosResult>;

/**
 * Generate a summary score for content visibility
 */
export function generateVisibilityScore(analysis: ContentAnalysis): VisibilityScore;

/** MAIN API FUNCTIONS */

/**
 * Quick analysis function for common use cases
 */
export function analyzeVisibility(
  initialHtml: string, 
  renderedHtml: string, 
  options?: AnalysisOptions
): Promise<ContentAnalysis>;

/**
 * Compare two HTML contents and get quick metrics
 */
export function quickCompare(
  html1: string, 
  html2: string, 
  options?: QuickCompareOptions
): Promise<QuickCompareResult>;

/**
 * Get citation readiness score for a webpage
 */
export function getCitationReadiness(
  initialHtml: string, 
  renderedHtml: string, 
  options?: AnalysisOptions
): Promise<CitationReadinessResult>;
