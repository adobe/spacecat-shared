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
 * Text tokenization and normalization utilities
 * Handles intelligent word and line tokenization with URL preservation
 */

/**
 * Tokenizes text into words or lines with intelligent normalization
 *
 * @param {string} text - The input text to tokenize
 * @param {string} [mode="word"] - Tokenization mode: "word" or "line"
 *
 * @returns {string[]} Array of normalized tokens
 *
 * @description
 * Word mode features:
 * - Normalizes whitespace (collapses multiple spaces, removes leading/trailing)
 * - Standardizes punctuation spacing (e.g., "hello , world" → "hello, world")
 * - Preserves URLs, emails, and structured data as single tokens
 * - Uses robust placeholder system with private Unicode characters
 * - Protects: https://, www., .com/.org/.net/.edu/.gov, email@domain.ext
 *
 * Line mode features:
 * - Normalizes line endings to consistent format
 * - Collapses horizontal whitespace within lines
 * - Removes empty lines and excessive line breaks
 *
 * @example
 * // Word tokenization with punctuation normalization
 * tokenize("Hello , world !")
 * // → ["Hello,", "world!"]
 *
 * @example
 * // URL preservation
 * tokenize("Visit https://example.com , please")
 * // → ["Visit", "https://example.com,", "please"]
 *
 * @example
 * // Line tokenization
 * tokenize("Line 1\n\nLine 2\n   Line 3", "line")
 * // → ["Line 1", "Line 2", "Line 3"]
 */
export function tokenize(text, mode = 'word') {
  if (!text || typeof text !== 'string') {
    return [];
  }

  if (mode === 'line') {
    // For line mode: normalize whitespace first, then split by lines and filter out empty lines
    const normalized = text
      .replace(/\r\n?|\n/g, '\n') // Normalize line endings
      .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace to single space
      .replace(/\n\s*\n/g, '\n') // Collapse multiple empty lines to single
      .trim();
    return normalized.split(/\n/).filter((line) => line.length > 0);
  } else {
    // For word mode: normalize all whitespace thoroughly before tokenizing
    let clean = text
      .replace(/\r\n?|\n/g, ' ') // Convert newlines to spaces
      .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
      .replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace more explicitly

    // Protect URLs/links by temporarily replacing them with unique placeholders
    const urlPattern = /\S*(?:https?:\/\/|www\.|\.com|\.org|\.net|\.edu|\.gov|@\S+\.\S+)\S*/gi;
    const urlMap = new Map();
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    clean = clean.replace(urlPattern, (match) => {
      const placeholder = `\u{E000}${uniqueId}_${urlMap.size}\u{E001}`; // Using private use Unicode chars
      urlMap.set(placeholder, match);
      return placeholder;
    });

    // Now normalize punctuation spacing on the text without URLs
    clean = clean
      .replace(/\s*([,.!?;:])\s*/g, '$1 ') // Normalize punctuation spacing
      .replace(/\s+/g, ' '); // Final collapse of any remaining multi-spaces

    // Restore URLs
    for (const [placeholder, originalUrl] of urlMap) {
      clean = clean.replace(placeholder, originalUrl);
    }

    // Split by whitespace and filter out empty tokens
    return clean.split(/\s+/).filter((token) => token.length > 0);
  }
}

/**
 * Normalize text for consistent comparison
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text) return '';

  return text
    .replace(/\r\n?|\n/g, ' ') // Convert newlines to spaces
    .replace(/\s+/g, ' ') // Collapse multiple whitespace
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Count words in text using tokenization
 * @param {string} text - Input text
 * @returns {number} Word count
 */
export function countWords(text) {
  return tokenize(text, 'word').length;
}

/**
 * Count lines in text using tokenization
 * @param {string} text - Input text
 * @returns {number} Line count
 */
export function countLines(text) {
  return tokenize(text, 'line').length;
}
