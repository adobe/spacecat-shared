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

/**
 * Converts inline marked tokens into ADF text nodes with marks.
 * Marks are accumulated recursively — nested `**bold *italic***` produces
 * text nodes carrying both `strong` and `em` marks.
 *
 * @param {import('marked').Token[]} tokens
 * @param {object[]} parentMarks - marks inherited from ancestor tokens
 * @returns {object[]} array of ADF inline nodes
 */
function inlineToAdf(tokens, parentMarks = []) {
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
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'strong' }]));
        break;

      case 'em':
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'em' }]));
        break;

      case 'del':
        nodes.push(...inlineToAdf(token.tokens, [...parentMarks, { type: 'strike' }]));
        break;

      case 'codespan': {
        // ADF constraint: code mark disallows other marks except link
        const codeMarks = [{ type: 'code' }];
        const linkMark = parentMarks.find((m) => m.type === 'link');
        if (linkMark) {
          codeMarks.push(linkMark);
        }
        nodes.push({ type: 'text', text: token.text, marks: codeMarks });
        break;
      }

      case 'link':
        nodes.push(...inlineToAdf(token.tokens, [
          ...parentMarks,
          { type: 'link', attrs: { href: token.href } },
        ]));
        break;

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
          const node = { type: 'text', text: token.text };
          if (parentMarks.length) {
            node.marks = [...parentMarks];
          }
          nodes.push(node);
        }
        break;
    }
  }
  // Drop empty text nodes — Jira rejects ADF with { type: "text", text: "" }
  return nodes.filter((n) => n.type !== 'text' || n.text);
}

/**
 * Converts block-level marked tokens into ADF block nodes.
 * Supports: paragraph, heading, code, list (ordered + unordered),
 * blockquote, horizontal rule, and table.
 *
 * @param {import('marked').Token[]} tokens
 * @returns {object[]} array of ADF block nodes
 */
function tokensToAdf(tokens) {
  const nodes = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        nodes.push({
          type: 'heading',
          attrs: { level: token.depth },
          content: inlineToAdf(token.tokens),
        });
        break;

      case 'paragraph':
        nodes.push({
          type: 'paragraph',
          content: inlineToAdf(token.tokens),
        });
        break;

      // Tight list items produce block-level 'text' tokens with inline sub-tokens
      case 'text':
        nodes.push({
          type: 'paragraph',
          content: inlineToAdf(token.tokens),
        });
        break;

      case 'code':
        nodes.push({
          type: 'codeBlock',
          attrs: token.lang ? { language: token.lang } : {},
          content: [{ type: 'text', text: token.text }],
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
            content: tokensToAdf(item.tokens),
          });
        }
        nodes.push(listNode);
        break;
      }

      case 'blockquote':
        nodes.push({
          type: 'blockquote',
          content: tokensToAdf(token.tokens),
        });
        break;

      case 'hr':
        nodes.push({ type: 'rule' });
        break;

      case 'table': {
        // ADF requires table cells to have at least one content node.
        // Empty cells are padded with a space to satisfy the constraint.
        const safeCellContent = (cellTokens) => {
          const content = inlineToAdf(cellTokens);
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
          nodes.push({
            type: 'paragraph',
            content: [{ type: 'text', text: token.text }],
          });
        }
        break;
    }
  }
  return nodes;
}

/**
 * Converts a markdown string to an ADF document.
 * Uses `marked.lexer()` for tokenization (no HTML rendering) then maps
 * tokens to ADF nodes via `tokensToAdf()` / `inlineToAdf()`.
 *
 * Returns null for blank input so callers can omit the field entirely.
 *
 * @param {string|null|undefined} text
 * @returns {object|null} ADF document or null
 */
export default function markdownToAdf(text) {
  const safeText = String(text ?? '').trim();
  if (!safeText) {
    return null;
  }

  const tokens = lexer(safeText);
  const content = tokensToAdf(tokens);

  return { version: 1, type: 'doc', content };
}
