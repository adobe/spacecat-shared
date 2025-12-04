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
 * Check if element is a browser DOM element (has outerHTML property)
 * @param {Object} el - Element to check
 * @returns {boolean} True if DOM element, false if cheerio element
 * @private
 */
function isDOMElement(el) {
  return typeof el.outerHTML === 'string';
}

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
 * Get tag name from element
 * @param {Object} el - Element (DOM or cheerio)
 * @returns {string} Uppercase tag name
 * @private
 */
function getTagName(el) {
  // DOM elements have uppercase tagName, cheerio has lowercase name
  return (el.tagName || el.name || '').toUpperCase();
}

/**
 * Get children elements
 * @param {Object} el - Element (DOM or cheerio)
 * @returns {Array} Array of child elements
 * @private
 */
function getChildren(el) {
  if (isDOMElement(el)) {
    return Array.from(el.children || []);
  }
  // Cheerio raw element has children array with type info
  return (el.children || []).filter((c) => c.type === 'tag');
}

/**
 * Get text content from element
 * @param {Object} el - Element (DOM or cheerio)
 * @param {Function} [$] - Cheerio instance (required for cheerio elements)
 * @returns {string} Text content
 * @private
 */
function getTextContent(el, $) {
  if (isDOMElement(el)) {
    return el.textContent || '';
  }
  // Use cheerio's text() method
  return $(el).text();
}

/**
 * Get outer HTML from element
 * @param {Object} el - Element (DOM or cheerio)
 * @param {Function} [$] - Cheerio instance (required for cheerio elements)
 * @returns {string} Outer HTML
 * @private
 */
function getOuterHTML(el, $) {
  if (isDOMElement(el)) {
    return el.outerHTML;
  }
  // Use cheerio's html() method
  return $.html(el);
}

/**
 * Extract blocks from parsed HTML, breaking down lists into individual items
 * Works with both browser DOM elements and cheerio raw elements
 * @param {Array} children - Array of child elements (DOM or cheerio)
 * @param {Function} [$] - Cheerio instance (required for Node.js, optional for browser)
 * @returns {Array<{html: string, text: string, tagName: string}>} Extracted blocks
 * @private
 */
function extractBlocks(children, $) {
  const blocks = [];
  children.forEach((el) => {
    const tagName = getTagName(el);

    // If it's a list (ul/ol), break it down into individual list items
    if (tagName === 'UL' || tagName === 'OL') {
      const listType = tagName.toLowerCase();
      const listChildren = getChildren(el);

      listChildren.forEach((li) => {
        if (getTagName(li) === 'LI') {
          // Skip empty list items - they cause alignment issues
          const liText = getTextContent(li, $).trim();
          if (!liText) return;

          // Check if the list item contains nested block elements (p, div, h1-h6, etc.)
          const liChildren = getChildren(li);
          const nestedBlocks = liChildren.filter((child) => {
            const childTag = getTagName(child);
            return childTag === 'P' || childTag === 'DIV' || childTag === 'H1'
                   || childTag === 'H2' || childTag === 'H3' || childTag === 'H4'
                   || childTag === 'H5' || childTag === 'H6'
                   || childTag === 'BLOCKQUOTE' || childTag === 'PRE';
          });

          if (nestedBlocks.length > 0) {
            // Extract nested blocks individually for better matching
            // but wrap them in li/ul for proper display
            nestedBlocks.forEach((child) => {
              const childText = getTextContent(child, $).trim();
              if (!childText) return; // Skip empty nested blocks too

              blocks.push({
                html: `<${listType}><li>${getOuterHTML(child, $)}</li></${listType}>`,
                text: childText,
                tagName: getTagName(child).toLowerCase(),
              });
            });
          } else {
            // No nested blocks, treat the whole li as one block
            // wrap in ul/ol for proper display
            blocks.push({
              html: `<${listType}>${getOuterHTML(li, $)}</${listType}>`,
              text: liText,
              tagName: 'li',
            });
          }
        }
      });
    } else {
      // For all other elements, add them as-is
      const text = getTextContent(el, $).trim();
      if (text) {
        blocks.push({
          html: getOuterHTML(el, $),
          text,
          tagName: tagName.toLowerCase(),
        });
      }
    }
  });
  return blocks;
}

/**
 * Get only the added markdown blocks (content in current but not in original)
 * @param {Array} originalChildren - Array of original DOM child elements
 * @param {Array} currentChildren - Array of current DOM child elements
 * @param {Function} [$] - Cheerio instance (required for Node.js, optional for browser)
 * @returns {{addedBlocks: Array<{html: string, text: string}>, addedCount: number}}
 * Added blocks with both HTML and text content
 */
export function getAddedMarkdownBlocks(originalChildren, currentChildren, $) {
  const originalBlocks = extractBlocks(originalChildren, $);
  const currentBlocks = extractBlocks(currentChildren, $);

  const ops = diffDOMBlocks(originalBlocks, currentBlocks);

  // Extract both HTML and text content from added blocks
  const addedBlocks = ops
    .filter((op) => op.type === 'add')
    .map((op) => ({
      html: op.currentBlock.html,
      text: op.currentBlock.text,
    }));

  return {
    addedBlocks,
    addedCount: addedBlocks.length,
  };
}

/**
 * Create markdown table diff from parsed DOM children
 * @param {Array} originalChildren - Array of original DOM child elements
 * @param {Array} currentChildren - Array of current DOM child elements
 * @param {Function} [$] - Cheerio instance (required for Node.js, optional for browser)
 * @returns {{tableHtml: string, counters: string}} Diff table and counter information
 */
export function createMarkdownTableDiff(originalChildren, currentChildren, $) {
  // Get all block-level elements from both sides and extract their text content
  const originalBlocks = extractBlocks(originalChildren, $);
  const currentBlocks = extractBlocks(currentChildren, $);

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
 * @returns {Promise<string>} Rendered markdown HTML
 */
export async function htmlToRenderedMarkdown(html, ignoreNavFooter = true) {
  // Extract body content only (with nav/footer filtering applied)
  const bodyContent = await filterHtmlContent(html, ignoreNavFooter, false);

  // Convert to markdown and back to HTML
  const markdown = await htmlToMarkdown(bodyContent);
  return markdownToHtml(markdown);
}

/**
 * Generate complete markdown diff with HTML to Markdown conversion
 * @param {string} originalHtml - Original HTML content
 * @param {string} currentHtml - Current HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to filter nav/footer elements
 * @returns {Promise<{originalRenderedHtml: string, currentRenderedHtml: string}>}
 * Rendered markdown HTML for both sides
 */
export async function generateMarkdownDiff(originalHtml, currentHtml, ignoreNavFooter = true) {
  // Convert both HTMLs to rendered markdown HTML
  const [originalRenderedHtml, currentRenderedHtml] = await Promise.all([
    htmlToRenderedMarkdown(originalHtml, ignoreNavFooter),
    htmlToRenderedMarkdown(currentHtml, ignoreNavFooter),
  ]);

  return {
    originalRenderedHtml,
    currentRenderedHtml,
  };
}
