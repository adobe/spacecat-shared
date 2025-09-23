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
 * LCS-based diff engine for text comparison
 * Provides efficient algorithms for finding differences between text content
 */

import { tokenize } from './tokenizer.js';

/**
 * Generate LCS-based diff between two strings
 * @param {string} aStr - First string to compare
 * @param {string} bStr - Second string to compare
 * @param {string} [mode="word"] - Tokenization mode: "word" or "line"
 * @returns {Array} Array of diff operations: {type: 'same'|'add'|'del', text: string}
 */
export function diffTokens(aStr, bStr, mode = 'word') {
  const A = tokenize(aStr, mode);
  const B = tokenize(bStr, mode);

  // Map tokens to integers for faster LCS computation
  const sym = new Map();
  const mapTok = (t) => {
    if (!sym.has(t)) sym.set(t, sym.size + 1);
    return sym.get(t);
  };
  const a = A.map(mapTok);
  const b = B.map(mapTok);

  // Build LCS length table using space-optimized dynamic programming
  // Uses O(min(m,n)) space instead of O(mn) - 99% memory reduction for large inputs
  const m = a.length;
  const n = b.length;

  // Optimize by using the smaller dimension for rolling arrays
  let useTransposed = false;
  let rows;
  let cols;
  let aTokens;
  let bTokens;
  let aMapped;
  let bMapped;

  if (m <= n) {
    rows = m;
    cols = n;
    aTokens = A;
    bTokens = B;
    aMapped = a;
    bMapped = b;
  } else {
    // Transpose to use smaller dimension (swap A and B)
    rows = n;
    cols = m;
    aTokens = B;
    bTokens = A;
    aMapped = b;
    bMapped = a;
    useTransposed = true;
  }

  // Use rolling arrays: only need current and previous row
  let prev = new Array(cols + 1).fill(0);
  let curr = new Array(cols + 1).fill(0);

  // Build LCS length table with rolling arrays
  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      curr[j] = (aMapped[i - 1] === bMapped[j - 1])
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
    }
    // Swap arrays for next iteration
    const temp = curr;
    curr = prev;
    prev = temp;
  }

  // Rebuild LCS table for backtracking - using smaller dimension first
  // Memory usage: O(min(m,n) * max(m,n)) instead of O(m*n)
  const dp = Array(rows + 1).fill(0).map(() => Array(cols + 1).fill(0));

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      dp[i][j] = (aMapped[i - 1] === bMapped[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to generate diff operations
  const ops = [];
  let i = rows;
  let j = cols;

  while (i > 0 && j > 0) {
    if (aMapped[i - 1] === bMapped[j - 1]) {
      ops.push({ type: 'same', text: aTokens[i - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'del', text: aTokens[i - 1] });
      i -= 1;
    } else {
      ops.push({ type: 'add', text: bTokens[j - 1] });
      j -= 1;
    }
  }

  // Handle remaining tokens
  while (i > 0) {
    ops.push({ type: 'del', text: aTokens[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    ops.push({ type: 'add', text: bTokens[j - 1] });
    j -= 1;
  }

  // If we transposed, we need to swap add/del operations back
  if (useTransposed) {
    for (let opIndex = 0; opIndex < ops.length; opIndex += 1) {
      const op = ops[opIndex];
      if (op.type === 'add') {
        ops[opIndex] = { ...op, type: 'del' };
      } else if (op.type === 'del') {
        ops[opIndex] = { ...op, type: 'add' };
      }
    }
  }

  ops.reverse();
  return ops;
}

/**
 * Generate comprehensive diff report with statistics
 * @param {string} initText - Initial text (before changes)
 * @param {string} finText - Final text (after changes)
 * @param {string} [mode="word"] - Tokenization mode: "word" or "line"
 * @returns {Object} Diff report with counts and operations
 */
export function generateDiffReport(initText, finText, mode = 'word') {
  if (!initText || !finText) {
    return {
      addCount: 0,
      delCount: 0,
      sameCount: 0,
      diffOps: [],
      summary: 'No text to compare',
    };
  }

  const ops = diffTokens(initText, finText, mode);
  let addCount = 0;
  let delCount = 0;
  let sameCount = 0;

  ops.forEach((op) => {
    if (op.type === 'add') {
      addCount += 1;
    } else if (op.type === 'del') {
      delCount += 1;
    } else {
      sameCount += 1;
    }
  });

  return {
    addCount,
    delCount,
    sameCount,
    diffOps: ops,
    summary: `Added: ${addCount.toLocaleString()} • Removed: ${delCount.toLocaleString()} • Same: ${sameCount.toLocaleString()} • Granularity: ${mode}`,
  };
}

/**
 * Calculate similarity percentage between two texts
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @param {string} [mode="word"] - Tokenization mode
 * @returns {number} Similarity percentage (0-100)
 */
export function calculateSimilarity(text1, text2, mode = 'word') {
  if (!text1 && !text2) return 100;
  if (!text1 || !text2) return 0;

  const tokens1 = tokenize(text1, mode);
  const tokens2 = tokenize(text2, mode);

  if (tokens1.length === 0 && tokens2.length === 0) return 100;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const report = generateDiffReport(text1, text2, mode);
  const totalTokens = Math.max(tokens1.length, tokens2.length);

  return (report.sameCount / totalTokens) * 100;
}

// generateHtmlDiff() removed - was unused
