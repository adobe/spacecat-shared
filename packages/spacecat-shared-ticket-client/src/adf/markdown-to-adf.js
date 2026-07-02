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

import { lexer } from 'marked';

// 1 MB cap — prevents DoS via large inputs (Lambda sync payload limit is 6 MB)
const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_DEPTH = 20; // prevents stack overflow via deeply nested markdown

/**
 * Converts inline marked tokens into ADF text nodes with marks.
 *
 * @param {import('marked').Token[]} tokens
 * @param {object[]} parentMarks - marks inherited from ancestor tokens
 * @param {number} depth - current recursion depth (DoS guard)
 * @returns {object[]} array of ADF inline nodes
 */
function inlineToAdf(tokens, parentMarks = [], depth = 0) {
  if (depth > MAX_DEPTH) {
    return [];
  }
  const nodes = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const node = { type: 'text', text: token.text };
        if (parentMarks.length) {
          node.marks = [...parentMarks];
        }
        nodes.push(node);
        break;
      }

      case 'strong':
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'strong' }], depth + 1));
        break;

      case 'em':
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'em' }], depth + 1));
        break;

      case 'del':
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'strike' }], depth + 1));
        break;

      case 'codespan': {
        const codeMarks = [{ type: 'code' }];
        const linkMark = parentMarks.find((m) => m.type === 'link');
        if (linkMark) {
          codeMarks.push(linkMark);
        }
        nodes.push({ type: 'text', text: token.text, marks: codeMarks });
        break;
      }

      case 'link': {
        const href = /^(https?|mailto):/i.test(token.href || '') ? token.href : null;
        if (href) {
          nodes.push(...inlineToAdf(token.tokens, [
            ...parentMarks,
            { type: 'link', attrs: { href } },
          ], depth + 1));
        } else {
          nodes.push(...inlineToAdf(token.tokens, parentMarks, depth + 1));
        }
        break;
      }

      case 'br':
        nodes.push({ type: 'hardBreak' });
        break;

      case 'escape': {
        const node = { type: 'text', text: token.text };
        if (parentMarks.length) {
          node.marks = [...parentMarks];
        }
        nodes.push(node);
        break;
      }

      default:
        if (token.text) {
          // Strip HTML tags from raw HTML inline tokens before placing as text
          const plainText = token.text.replace(/<[^>]*>/g, '').trim();
          if (plainText) {
            const node = { type: 'text', text: plainText };
            if (parentMarks.length) {
              node.marks = [...parentMarks];
            }
            nodes.push(node);
          }
        }
        break;
    }
  }
  return nodes.filter((n) => n.type !== 'text' || n.text);
}

/**
 * Converts block-level marked tokens into ADF block nodes.
 *
 * @param {import('marked').Token[]} tokens
 * @param {number} depth - current recursion depth (DoS guard)
 * @returns {object[]} array of ADF block nodes
 */
function tokensToAdf(tokens, depth = 0) {
  if (depth > MAX_DEPTH) {
    return [];
  }
  const nodes = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        nodes.push({
          type: 'heading',
          attrs: { level: token.depth },
          content: inlineToAdf(token.tokens, [], depth + 1),
        });
        break;

      case 'paragraph':
        nodes.push({
          type: 'paragraph',
          content: inlineToAdf(token.tokens, [], depth + 1),
        });
        break;

      case 'text':
        nodes.push({
          type: 'paragraph',
          content: inlineToAdf(token.tokens, [], depth + 1),
        });
        break;

      case 'code':
        nodes.push({
          type: 'codeBlock',
          attrs: token.lang ? { language: token.lang } : {},
          // ADF rejects empty text nodes — pad empty code blocks with a space
          content: [{ type: 'text', text: token.text || ' ' }],
        });
        break;

      case 'list': {
        const listType = token.ordered ? 'orderedList' : 'bulletList';
        const listNode = { type: listType, content: [] };
        if (token.ordered) {
          listNode.attrs = { order: token.start };
        }
        for (const item of token.items) {
          listNode.content.push({
            type: 'listItem',
            content: tokensToAdf(item.tokens, depth + 1),
          });
        }
        nodes.push(listNode);
        break;
      }

      case 'blockquote':
        nodes.push({
          type: 'blockquote',
          content: tokensToAdf(token.tokens, depth + 1),
        });
        break;

      case 'hr':
        nodes.push({ type: 'rule' });
        break;

      case 'table': {
        const safeCellContent = (cellTokens) => {
          const content = inlineToAdf(cellTokens, [], depth + 1);
          return content.length ? content : [{ type: 'text', text: ' ' }];
        };
        const rows = [];
        rows.push({
          type: 'tableRow',
          content: token.header.map((cell) => ({
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: safeCellContent(cell.tokens) }],
          })),
        });
        for (const row of token.rows) {
          rows.push({
            type: 'tableRow',
            content: row.map((cell) => ({
              type: 'tableCell',
              content: [{ type: 'paragraph', content: safeCellContent(cell.tokens) }],
            })),
          });
        }
        nodes.push({ type: 'table', content: rows });
        break;
      }

      case 'space':
        break;

      default:
        if (token.text) {
          // Strip HTML tags from raw HTML block tokens before placing as paragraph
          const plainText = token.text.replace(/<[^>]*>/g, '').trim();
          if (plainText) {
            nodes.push({
              type: 'paragraph',
              content: [{ type: 'text', text: plainText }],
            });
          }
        }
        break;
    }
  }
  return nodes;
}

/**
 * Converts a markdown string to an ADF document.
 *
 * Input is capped at 1 MB to prevent DoS via large payloads.
 * Deeply nested structures are capped at depth 20.
 * Conversion errors fall back to a plain-text paragraph.
 *
 * @param {string|null|undefined} text
 * @returns {object|null} ADF document or null
 */
export default function markdownToAdf(text) {
  const safeText = String(text ?? '').trim();
  if (!safeText) {
    return null;
  }

  // Cap input to prevent DoS via oversized payloads
  const truncated = safeText.length > MAX_INPUT_BYTES
    ? safeText.slice(0, MAX_INPUT_BYTES)
    : safeText;

  try {
    const tokens = lexer(truncated);
    const content = tokensToAdf(tokens, 0);
    return { version: 1, type: 'doc', content };
  } catch { /* c8 ignore next */
    // Fallback: return input as a single plain-text paragraph to avoid crashing
    // callers (e.g. RangeError from pathological nesting not caught by depth guard).
    // The catch branch is intentionally not covered in unit tests: the depth guard
    // prevents all known nesting-based throws, and `marked.lexer` is ESM-bound so
    // it cannot be stubbed without esmock in this test setup.
    return {
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: truncated.slice(0, 1000) }],
      }],
    };
  }
}
