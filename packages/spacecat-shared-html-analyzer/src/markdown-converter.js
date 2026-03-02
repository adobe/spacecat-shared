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
 * Markdown conversion utilities
 * Provides HTML to Markdown and Markdown to HTML conversions
 */

import { isBrowser, getGlobalObject } from './utils.js';

// Cache for imported modules in Node.js
let TurndownServiceClass = null;
let markedParser = null;

/**
 * Get Turndown service instance
 * @private
 * @returns {Promise<Object>} TurndownService instance
 */
async function getTurndownService() {
  if (isBrowser()) {
    // In browser environment, expect global TurndownService
    const globalObj = getGlobalObject();
    if (globalObj.TurndownService) {
      return new globalObj.TurndownService();
    }
    throw new Error('TurndownService must be loaded in browser environment');
  }
  // In Node.js environment, dynamically import turndown
  if (!TurndownServiceClass) {
    const module = await import('turndown');
    TurndownServiceClass = module.default;
  }
  return new TurndownServiceClass();
}

/**
 * Get marked parser
 * @private
 * @returns {Promise<Object>} marked parser
 */
async function getMarked() {
  if (isBrowser()) {
    // In browser environment, expect global marked
    const globalObj = getGlobalObject();
    if (globalObj.marked) {
      return globalObj.marked;
    }
    throw new Error('marked must be loaded in browser environment');
  }
  // In Node.js environment, dynamically import marked
  if (!markedParser) {
    const module = await import('marked');
    markedParser = module.marked;
  }
  return markedParser;
}

/**
 * Convert HTML to Markdown
 * @param {string} html - HTML content to convert
 * @returns {Promise<string>} Markdown content
 */
export async function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const turndownService = await getTurndownService();
  return turndownService.turndown(html);
}

/**
 * Convert Markdown to HTML
 * @param {string} markdown - Markdown content to convert
 * @returns {Promise<string>} HTML content
 */
export async function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  const marked = await getMarked();
  return marked.parse(markdown);
}

/**
 * Convert HTML to Markdown and then render it back to HTML
 * Useful for normalizing HTML through markdown representation
 * @param {string} html - HTML content to convert
 * @returns {Promise<string>} Rendered HTML from markdown
 */
export async function htmlToMarkdownToHtml(html) {
  const markdown = await htmlToMarkdown(html);
  return markdownToHtml(markdown);
}
