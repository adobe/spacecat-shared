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
 * Markdown diff utilities
 * Provides DOM block-level diffing for markdown content
 */

import { filterHtmlContent } from './html-filter.js';
import { htmlToMarkdown, markdownToHtml } from './markdown-converter.js';

/**
 * Diff DOM blocks using LCS algorithm
 * Compares blocks based on text content while preserving full HTML structure
 * @param {Array<{html: string, text: string, tagName: string}>} originalBlocks
 * - Original DOM blocks
 * @param {Array<{html: string, text: string, tagName: string}>} currentBlocks
 * - Current DOM blocks
 * @returns {Array<{type: 'same'|'del'|'add', originalBlock?: Object,
 * currentBlock?: Object}>} Diff operations
 */
export function diffDOMBlocks(originalBlocks, currentBlocks) {
  // Create a mapping function that uses text content for comparison
  // while preserving the full HTML structure
  const A = originalBlocks.map((block) => block.text);
  const B = currentBlocks.map((block) => block.text);

  // Map tokens to ints for faster LCS
  const sym = new Map();
  const mapTok = (t) => {
    if (!sym.has(t)) sym.set(t, sym.size + 1);
    return sym.get(t);
  };
  const a = A.map(mapTok);
  const b = B.map(mapTok);

  // LCS length table
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = (a[i - 1] === b[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to collect ops with full block data
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({
        type: 'same',
        originalBlock: originalBlocks[i - 1],
        currentBlock: currentBlocks[j - 1],
      });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({
        type: 'del',
        originalBlock: originalBlocks[i - 1],
      });
      i -= 1;
    } else {
      ops.push({
        type: 'add',
        currentBlock: currentBlocks[j - 1],
      });
      j -= 1;
    }
  }
  while (i > 0) {
    ops.push({
      type: 'del',
      originalBlock: originalBlocks[i - 1],
    });
    i -= 1;
  }
  while (j > 0) {
    ops.push({
      type: 'add',
      currentBlock: currentBlocks[j - 1],
    });
    j -= 1;
  }
  ops.reverse();
  return ops;
}

/**
 * Extract blocks from parsed HTML, breaking down lists into individual items
 * @param {Array} children - Array of child elements
 * @returns {Array<{html: string, text: string, tagName: string}>} Extracted blocks
 * @private
 */
function extractBlocks(children) {
  const blocks = [];
  children.forEach((el) => {
    // If it's a list (ul/ol), break it down into individual list items
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const listType = el.tagName.toLowerCase();
      Array.from(el.children).forEach((li) => {
        if (li.tagName === 'LI') {
          // Skip empty list items - they cause alignment issues
          const liText = li.textContent?.trim() || '';
          if (!liText) return;

          // Check if the list item contains nested block elements (p, div, h1-h6, etc.)
          const nestedBlocks = Array.from(li.children).filter((child) => {
            const tag = child.tagName;
            return tag === 'P' || tag === 'DIV' || tag === 'H1' || tag === 'H2'
                   || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6'
                   || tag === 'BLOCKQUOTE' || tag === 'PRE';
          });

          if (nestedBlocks.length > 0) {
            // Extract nested blocks individually for better matching
            // but wrap them in li/ul for proper display
            nestedBlocks.forEach((child) => {
              const childText = child.textContent?.trim() || '';
              if (!childText) return; // Skip empty nested blocks too

              blocks.push({
                html: `<${listType}><li>${child.outerHTML}</li></${listType}>`,
                text: child.textContent?.trim() || '',
                tagName: child.tagName.toLowerCase(),
              });
            });
          } else {
            // No nested blocks, treat the whole li as one block
            // wrap in ul/ol for proper display
            blocks.push({
              html: `<${listType}>${li.outerHTML}</${listType}>`,
              text: li.textContent?.trim() || '',
              tagName: 'li',
            });
          }
        }
      });
    } else {
      // For all other elements, add them as-is
      blocks.push({
        html: el.outerHTML,
        text: el.textContent?.trim() || '',
        tagName: el.tagName.toLowerCase(),
      });
    }
  });
  return blocks;
}

/**
 * Create markdown table diff from parsed DOM children
 * @param {Array} originalChildren - Array of original DOM child elements
 * @param {Array} currentChildren - Array of current DOM child elements
 * @returns {{tableHtml: string, counters: string}} Diff table and counter information
 */
export function createMarkdownTableDiff(originalChildren, currentChildren) {
  // Get all block-level elements from both sides and extract their text content
  const originalBlocks = extractBlocks(originalChildren);
  const currentBlocks = extractBlocks(currentChildren);

  // Run diff algorithm once and count changes
  const ops = diffDOMBlocks(originalBlocks, currentBlocks);
  let addCount = 0;
  let delCount = 0;

  // Create table rows based on diff operations and count changes
  const tableRows = [];
  ops.forEach((op) => {
    if (op.type === 'same') {
      // Show unchanged blocks on both sides
      const leftContent = op.originalBlock.html;
      const rightContent = op.currentBlock.html;
      tableRows.push(`<tr><td class="diff-line-same markdown-rendered">${leftContent}</td><td class="diff-line-same markdown-rendered">${rightContent}</td></tr>`);
    } else if (op.type === 'del') {
      // Show deleted blocks only on left side
      delCount += 1;
      const leftContent = op.originalBlock.html;
      tableRows.push(`<tr><td class="diff-line-del markdown-rendered">${leftContent}</td><td class="diff-line-empty"></td></tr>`);
    } else if (op.type === 'add') {
      // Show added blocks only on right side
      addCount += 1;
      const rightContent = op.currentBlock.html;
      tableRows.push(`<tr><td class="diff-line-empty"></td><td class="diff-line-add markdown-rendered">${rightContent}</td></tr>`);
    }
  });

  const hasChanges = addCount > 0 || delCount > 0;
  const counters = hasChanges
    ? `${addCount} block additions, ${delCount} block deletions`
    : 'No differences';

  return {
    tableHtml: tableRows.join('\n'),
    counters,
  };
}

/**
 * Convert HTML to rendered markdown HTML (for display)
 * @param {string} html - HTML content to convert
 * @param {boolean} [ignoreNavFooter=true] - Whether to filter nav/footer elements
 * @returns {string} Rendered markdown HTML
 */
export function htmlToRenderedMarkdown(html, ignoreNavFooter = true) {
  // Extract body content only (with nav/footer filtering applied)
  // Handle both sync (browser) and async (Node.js) filterHtmlContent
  const bodyContentResult = filterHtmlContent(html, ignoreNavFooter, false);

  // For browser (sync)
  if (!(bodyContentResult instanceof Promise)) {
    const markdown = htmlToMarkdown(bodyContentResult);
    return markdownToHtml(markdown);
  }

  // For Node.js (async) - though this won't be used in browser
  return bodyContentResult.then((bodyContent) => {
    const markdown = htmlToMarkdown(bodyContent);
    return markdownToHtml(markdown);
  });
}

/**
 * Generate complete markdown diff with HTML to Markdown conversion
 * @param {string} originalHtml - Original HTML content
 * @param {string} currentHtml - Current HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to filter nav/footer elements
 * @returns {{originalRenderedHtml: string, currentRenderedHtml: string}}
 * Rendered markdown HTML for both sides
 */
export function generateMarkdownDiff(originalHtml, currentHtml, ignoreNavFooter = true) {
  // Convert both HTMLs to rendered markdown HTML
  const originalRenderedHtml = htmlToRenderedMarkdown(originalHtml, ignoreNavFooter);
  const currentRenderedHtml = htmlToRenderedMarkdown(currentHtml, ignoreNavFooter);

  // Return the rendered HTML strings for the caller to parse and diff
  return {
    originalRenderedHtml,
    currentRenderedHtml,
  };
}
