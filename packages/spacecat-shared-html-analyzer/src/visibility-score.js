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
 * Improved Visibility / Readability Score calculation
 *
 * Replaces the naive word-count ratio with a composite metric that measures
 * how much of the meaningful, user-facing content is actually accessible to
 * AI agents (crawlers, citation engines, etc.).
 *
 * Score components (all 0-100, combined into a single 0-100 score):
 *
 *  1. Content Recall (weight 0.40)
 *     Fraction of user-visible tokens that are also present in the agent view,
 *     measured via LCS (Longest Common Subsequence) overlap so that ordering
 *     is respected.  Uses the same diffTokens engine already in the codebase.
 *
 *  2. Vocabulary Coverage (weight 0.30)
 *     Fraction of unique meaningful terms in the user view that exist in the
 *     agent view.  Filters out common English stop-words so that structural
 *     words ("the", "and", …) do not inflate the score.  Captures whether the
 *     agent can "understand" the content even if exact ordering differs.
 *
 *  3. Structural Completeness (weight 0.15)
 *     Compares the count of semantic block-level elements (headings, paragraphs,
 *     list items, tables) between the two views.  A page that exposes 0 headings
 *     to the agent while the user sees 10 is penalised proportionally.
 *
 *  4. Content Density Parity (weight 0.15)
 *     Compares the ratio of meaningful (non-stop-word) tokens to total tokens
 *     between the two views.  A very high or very low ratio on the agent side
 *     compared with the user view signals either bloated boilerplate or stripped
 *     content.
 *
 * The composite score deliberately avoids penalising pages whose agent view is
 * *longer* than the user view (e.g. server-side rendered pages with extra markup)
 * — it only penalises when the agent view is *missing* user content.
 */

import { tokenize } from './tokenizer.js';
import { diffTokens } from './diff-engine.js';

// ---------------------------------------------------------------------------
// Stop-word list (common English function words)
// Keeping this inline (no external dependency) to stay browser-compatible.
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
  'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
  'these', 'those', 'this', 'that', 'it', 'its', 'itself', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'hers',
  'up', 'if', 'about', 'against', 'because', 'until', 'while', 'also',
]);

/**
 * Normalise a token to lowercase, stripping surrounding punctuation.
 * @param {string} token
 * @returns {string}
 * @private
 */
function normaliseToken(token) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

/**
 * Return only the "meaningful" (non-stop-word) tokens from a token array.
 * @param {string[]} tokens
 * @returns {string[]}
 * @private
 */
function meaningfulTokens(tokens) {
  return tokens
    .map(normaliseToken)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Clamp a numeric value between 0 and 100.
 * @param {number} v
 * @returns {number}
 * @private
 */
function clamp100(v) {
  return Math.max(0, Math.min(100, v));
}

// ---------------------------------------------------------------------------
// Sub-score 1 – Content Recall
// ---------------------------------------------------------------------------

/**
 * Calculate the LCS-based content recall score.
 *
 * Measures the fraction of user tokens that appear (in order) in the agent
 * view.  Uses the existing diffTokens engine: "same" tokens in the diff are
 * those present in both views.
 *
 * @param {string[]} agentTokens  - Tokenised agent (initial) text
 * @param {string[]} userTokens   - Tokenised user (final) text
 * @returns {number} 0-100
 * @private
 */
function contentRecallScore(agentTokens, userTokens) {
  if (userTokens.length === 0) {
    // No user content → perfect recall (nothing to miss)
    return 100;
  }
  if (agentTokens.length === 0) {
    return 0;
  }

  const agentText = agentTokens.join(' ');
  const userText = userTokens.join(' ');

  const ops = diffTokens(agentText, userText, 'word');
  const sameCount = ops.filter((op) => op.type === 'same').length;

  // sameCount / userTokens.length  → fraction of user content preserved
  return clamp100((sameCount / userTokens.length) * 100);
}

// ---------------------------------------------------------------------------
// Sub-score 2 – Vocabulary Coverage
// ---------------------------------------------------------------------------

/**
 * Calculate vocabulary coverage score.
 *
 * What fraction of the unique meaningful terms a human user would encounter
 * is also present in the agent view?  Stop-words are excluded so that content
 * words drive the score.
 *
 * @param {string[]} agentTokens  - Tokenised agent text
 * @param {string[]} userTokens   - Tokenised user text
 * @returns {number} 0-100
 * @private
 */
function vocabularyCoverageScore(agentTokens, userTokens) {
  const userMeaningful = meaningfulTokens(userTokens);
  if (userMeaningful.length === 0) {
    return 100;
  }

  const agentMeaningfulSet = new Set(meaningfulTokens(agentTokens));
  const userUniqueTerms = new Set(userMeaningful);

  let covered = 0;
  for (const term of userUniqueTerms) {
    if (agentMeaningfulSet.has(term)) {
      covered += 1;
    }
  }

  return clamp100((covered / userUniqueTerms.size) * 100);
}

// ---------------------------------------------------------------------------
// Sub-score 3 – Structural Completeness
// ---------------------------------------------------------------------------

// Regex patterns to count structural HTML elements in raw HTML strings.
// We work on raw HTML rather than text so we can count tags without requiring
// a full DOM parse (keeping the function synchronous and browser-safe).
const STRUCTURAL_PATTERNS = [
  /<h[1-6][\s>]/gi, // headings
  /<p[\s>]/gi, // paragraphs
  /<li[\s>]/gi, // list items
  /<th[\s>]/gi, // table headers
  /<td[\s>]/gi, // table cells
  /<blockquote[\s>]/gi, // blockquotes
  /<dt[\s>]/gi, // definition terms
];

/**
 * Count total structural elements in a raw HTML string.
 * @param {string} html
 * @returns {number}
 * @private
 */
function countStructuralElements(html) {
  if (!html) return 0;
  return STRUCTURAL_PATTERNS.reduce((sum, pattern) => {
    const matches = html.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
}

/**
 * Calculate structural completeness score.
 *
 * Measures whether the structural element count in the agent view is
 * proportionate to that of the user view.  Pages with more structure in the
 * agent view than the user view are not penalised (only missing structure is).
 *
 * @param {string} agentHtml - Raw agent HTML
 * @param {string} userHtml  - Raw user HTML
 * @returns {number} 0-100
 * @private
 */
function structuralCompletenessScore(agentHtml, userHtml) {
  const userCount = countStructuralElements(userHtml);
  if (userCount === 0) {
    return 100; // No structure to preserve
  }
  const agentCount = countStructuralElements(agentHtml);
  // Ratio capped at 1 so extra agent structure does not inflate the score
  return clamp100((Math.min(agentCount, userCount) / userCount) * 100);
}

// ---------------------------------------------------------------------------
// Sub-score 4 – Content Density Parity
// ---------------------------------------------------------------------------

/**
 * Calculate the meaningful-word density (0.0 – 1.0) of a token array.
 * @param {string[]} tokens
 * @returns {number}
 * @private
 */
function contentDensity(tokens) {
  if (tokens.length === 0) return 0;
  const meaningful = meaningfulTokens(tokens);
  return meaningful.length / tokens.length;
}

/**
 * Calculate content density parity score.
 *
 * Compares the fraction of meaningful tokens in agent vs. user views.
 * A low agent density indicates boilerplate/noise was injected on the agent
 * side; a high density means the agent view may be stripped/incomplete.
 * The score measures proximity between the two densities.
 *
 * @param {string[]} agentTokens
 * @param {string[]} userTokens
 * @returns {number} 0-100
 * @private
 */
function contentDensityParityScore(agentTokens, userTokens) {
  const userDensity = contentDensity(userTokens);
  if (userDensity === 0) {
    return 100;
  }
  const agentDensity = contentDensity(agentTokens);
  // Normalised distance between the two densities (0 = identical, 1 = max)
  const distance = Math.abs(agentDensity - userDensity) / userDensity;
  // Perfect parity = 100; double the density difference = 0
  return clamp100((1 - Math.min(distance, 1)) * 100);
}

// ---------------------------------------------------------------------------
// Composite score weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  contentRecall: 0.40,
  vocabularyCoverage: 0.30,
  structuralCompleteness: 0.15,
  contentDensityParity: 0.15,
};

/**
 * @typedef {Object} VisibilityScoreResult
 * @property {number} score
 *   Composite visibility score (0–100, higher = better).
 * @property {number} contentRecall
 *   LCS-based fraction of user content present in agent view (0–100).
 * @property {number} vocabularyCoverage
 *   Fraction of unique meaningful user terms found in agent view (0–100).
 * @property {number} structuralCompleteness
 *   Fraction of structural HTML elements preserved in agent view (0–100).
 * @property {number} contentDensityParity
 *   Similarity of meaningful-word density between agent and user views (0–100).
 * @property {string} scoreLabel
 *   Human-readable label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'.
 */

/**
 * Derive a human-readable label from a numeric score.
 * @param {number} score 0-100
 * @returns {string}
 * @private
 */
function scoreLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

/**
 * Calculate an improved, multi-dimensional Visibility Score from pre-extracted
 * plain-text representations of the agent and user views.
 *
 * This variant is synchronous and works in both browser and Node.js
 * environments.  Use {@link calculateVisibilityScore} when raw HTML is
 * available so structural analysis can also be performed.
 *
 * @param {string} agentText - Plain text content as seen by AI agents / crawlers
 * @param {string} userText  - Plain text content as seen by human users
 * @returns {VisibilityScoreResult}
 */
export function calculateVisibilityScoreFromText(agentText, userText) {
  const agentTokens = tokenize(agentText || '', 'word');
  const userTokens = tokenize(userText || '', 'word');

  const recall = contentRecallScore(agentTokens, userTokens);
  const vocabulary = vocabularyCoverageScore(agentTokens, userTokens);
  // Structural score defaults to 100 when raw HTML is not available
  const structural = 100;
  const density = contentDensityParityScore(agentTokens, userTokens);

  const composite = Math.round(
    recall * WEIGHTS.contentRecall
    + vocabulary * WEIGHTS.vocabularyCoverage
    + structural * WEIGHTS.structuralCompleteness
    + density * WEIGHTS.contentDensityParity,
  );

  return {
    score: composite,
    contentRecall: Math.round(recall),
    vocabularyCoverage: Math.round(vocabulary),
    structuralCompleteness: structural,
    contentDensityParity: Math.round(density),
    scoreLabel: scoreLabel(composite),
  };
}

/**
 * Calculate an improved, multi-dimensional Visibility Score from raw HTML.
 *
 * Compares the "agent view" (initial / server-side HTML — what AI crawlers
 * and citation engines see) against the "user view" (final / client-side
 * HTML — what human users see after JS execution).
 *
 * The function is asynchronous because text extraction uses cheerio in
 * Node.js environments.
 *
 * @param {string} agentHtml - Raw agent-view HTML (server-side / initial)
 * @param {string} userHtml  - Raw user-view HTML (client-side / final)
 * @param {Object}  [options]
 * @param {boolean} [options.ignoreNavFooter=true]  Strip nav/footer before scoring
 * @param {boolean} [options.includeNoscript=false] Include noscript in agent text
 * @returns {Promise<VisibilityScoreResult>}
 */
export async function calculateVisibilityScore(
  agentHtml,
  userHtml,
  options = {},
) {
  const {
    ignoreNavFooter = true,
    includeNoscript = false,
  } = options;

  // Lazy import to stay compatible with the existing sync browser path in
  // html-filter.js – we only need the async Node.js path here.
  const { stripTagsToText } = await import('./html-filter.js');

  // Agent view: always include noscript (what crawlers see)
  const agentText = await Promise.resolve(
    stripTagsToText(agentHtml || '', ignoreNavFooter, true),
  );
  // User view: exclude noscript by default (what JS-enabled browsers see)
  const userText = await Promise.resolve(
    stripTagsToText(userHtml || '', ignoreNavFooter, includeNoscript),
  );

  const agentTokens = tokenize(agentText, 'word');
  const userTokens = tokenize(userText, 'word');

  const recall = contentRecallScore(agentTokens, userTokens);
  const vocabulary = vocabularyCoverageScore(agentTokens, userTokens);
  const structural = structuralCompletenessScore(agentHtml || '', userHtml || '');
  const density = contentDensityParityScore(agentTokens, userTokens);

  const composite = Math.round(
    recall * WEIGHTS.contentRecall
    + vocabulary * WEIGHTS.vocabularyCoverage
    + structural * WEIGHTS.structuralCompleteness
    + density * WEIGHTS.contentDensityParity,
  );

  return {
    score: composite,
    contentRecall: Math.round(recall),
    vocabularyCoverage: Math.round(vocabulary),
    structuralCompleteness: Math.round(structural),
    contentDensityParity: Math.round(density),
    scoreLabel: scoreLabel(composite),
  };
}
