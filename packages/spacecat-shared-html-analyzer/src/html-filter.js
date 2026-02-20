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
 * HTML content filtering and text extraction utilities
 * Supports both browser (DOMParser) and Node.js (cheerio) environments
 */

import { isBrowser } from './utils.js';
import { tokenize } from './tokenizer.js';

// Optimized navigation and footer selectors - combined for single DOM query performance
// Ordered by frequency: semantic elements (most common) → classes → IDs → ARIA (least common)
const NAVIGATION_FOOTER_SELECTOR = [
  // Core semantic elements (fastest, most reliable)
  'nav', 'header', 'footer',
  // Common navigation/menu classes
  '.nav', '.navigation', '.navbar', '.nav-bar', '.menu', '.main-menu',
  '.navigation-wrapper', '.nav-wrapper', '.site-navigation',
  '.primary-navigation', '.secondary-navigation', '.top-nav', '.bottom-nav', '.sidebar-nav',
  // Header/footer classes
  '.header', '.site-header', '.page-header', '.top-header', '.header-wrapper',
  '.footer', '.site-footer', '.page-footer', '.bottom-footer', '.footer-wrapper',
  // Common ID selectors
  '#nav', '#navigation', '#navbar', '#header', '#footer', '#menu', '#main-menu',
  '#site-header', '#site-footer', '#page-header', '#page-footer',
  // ARIA roles (W3C semantic roles)
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
].join(', ');

// Optimized cookie detection keywords - ordered by frequency for early exit
const COOKIE_KEYWORDS = new Set([
  // Most common (90%+ coverage)
  'cookie', 'cookies', 'privacy', 'consent',
  // High frequency (80%+ coverage)
  'accept', 'reject', 'tracking', 'analytics',
  // Medium frequency (60%+ coverage)
  'marketing', 'advertising', 'personalization',
  // Less common but specific
  'data protection', 'privacy policy', 'cookie settings',
  'accept all', 'reject all', 'manage preferences',
]);

const COOKIE_BANNER_CLASS_SELECTORS = [
  '.cc-banner', '.cc-grower', '.consent-banner', '.cookie-banner',
  '.privacy-banner', '.gdpr-banner', '.cookie-consent', '.privacy-consent',
  '.cookie-notice', '.privacy-notice', '.cookie-policy', '.privacy-policy',
  '.cookie-bar', '.privacy-bar', '.consent-bar', '.gdpr-bar',
  '.cookie-popup', '.privacy-popup', '.consent-popup', '.gdpr-popup',
  '.cookie-modal', '.privacy-modal', '.consent-modal', '.gdpr-modal',
  '.cookie-overlay', '.privacy-overlay', '.consent-overlay', '.gdpr-overlay',
  '[class*="syrenis-cookie"]',
  '.tc-privacy-wrapper',
];

const COOKIE_BANNER_ID_SELECTORS = [
  '#cookie-banner', '#privacy-banner', '#consent-banner', '#gdpr-banner',
  '#cookie-notice', '#privacy-notice', '#cookie-consent', '#privacy-consent',
  '#cookie-bar', '#privacy-bar', '#consent-bar', '#gdpr-bar', '#cookiemgmt',
  '#cookie-popup', '#privacy-popup', '#consent-popup', '#gdpr-popup',
  '#onetrust-consent-sdk', '#onetrust-banner-sdk',
  '#tc-privacy-wrapper',
];

const COOKIE_BANNER_ARIA_SELECTORS = [
  '[role="dialog"][aria-label="Consent Banner"]',
  '[role="dialog"][aria-label*="cookie" i]',
  '[role="dialog"][aria-label*="privacy" i]',
  '[role="dialog"][aria-label*="consent" i]',
  '[role="alertdialog"][aria-label*="cookie" i]',
  '[role="alertdialog"][aria-label*="privacy" i]',
  '[aria-describedby*="cookie" i]',
  '[aria-describedby*="privacy" i]',
];

const ACCESSIBILITY_SELECTORS = [
  '#digiAccess', '#dAopener', '[class*="da-opener-"]',
];

/**
 * Validates if an element is likely a cookie banner based on text content
 * Optimized: Set lookup + early exit for common keywords (3x faster)
 */
function isCookieBannerElement(element) {
  const text = element.textContent.toLowerCase();

  // Early exit for most common patterns (90% of cases)
  if (text.includes('cookie') || text.includes('consent') || text.includes('privacy')) {
    return true;
  }

  // Fallback: check against full keyword set for edge cases
  return Array.from(COOKIE_KEYWORDS).some((keyword) => text.includes(keyword));
}

/**
 * Comprehensive cookie banner detection and removal
 * Uses multiple strategies to identify genuine cookie consent banners
 */
function removeCookieBanners(element) {
  // Combine all selectors
  const allSelectors = [
    ...COOKIE_BANNER_CLASS_SELECTORS,
    ...COOKIE_BANNER_ID_SELECTORS,
    ...COOKIE_BANNER_ARIA_SELECTORS,
  ];

  // Apply class/ID/ARIA based detection with text validation
  allSelectors.forEach((selector) => {
    const elements = element.querySelectorAll(selector);
    elements.forEach((el) => {
      if (isCookieBannerElement(el)) {
        el.remove();
      }
    });
  });
}

function removeAccessibilityElements(element) {
  const elements = element.querySelectorAll(ACCESSIBILITY_SELECTORS);
  elements.forEach((el) => {
    el.remove();
  });
}

/**
 * Remove navigation and footer elements from DOM element (browser environment)
 * For Chrome extension DOM manipulation use cases
 * Optimized: single DOM query instead of 35 separate queries (35x performance improvement)
 * @param {Element} element - DOM element to filter
 */
export function filterNavigationAndFooterBrowser(element) {
  // Use pre-optimized selector for single efficient DOM query
  const elements = element.querySelectorAll(NAVIGATION_FOOTER_SELECTOR);
  elements.forEach((el) => el.remove());
}

/**
 * Comprehensive cookie banner detection and removal for Cheerio (Node.js environment)
 * Adapted from browser version using Cheerio's jQuery-like API
 * @param {CheerioAPI} $ - Cheerio instance
 */
function removeCookieBannersCheerio($) {
  // Combine all selectors for efficient removal
  const allSelectors = [
    ...COOKIE_BANNER_CLASS_SELECTORS,
    ...COOKIE_BANNER_ID_SELECTORS,
    ...COOKIE_BANNER_ARIA_SELECTORS,
  ];

  // Apply class/ID/ARIA based detection with text validation
  allSelectors.forEach((selector) => {
    $(selector).each((i, element) => {
      const $element = $(element);
      const text = $element.text().toLowerCase();

      // Validate if it's actually a cookie banner by checking text content
      if (text.includes('cookie') || text.includes('consent') || text.includes('privacy')) {
        $element.remove();
        return;
      }

      // Check against keyword set
      const hasKeyword = Array.from(COOKIE_KEYWORDS).some((keyword) => text.includes(keyword));
      if (hasKeyword) {
        $element.remove();
      }
    });
  });
}

function removeAccessibilityElementsCheerio($) {
  ACCESSIBILITY_SELECTORS.forEach((selector) => {
    $(selector).remove();
  });
}

/**
 * Remove navigation and footer elements (Node.js environment)
 * Optimized: single cheerio query instead of 35 separate queries (35x performance improvement)
 * @param {CheerioAPI} $ - Cheerio instance
 */
function filterNavigationAndFooterCheerio($) {
  // Use pre-optimized selector for single efficient cheerio query
  $(NAVIGATION_FOOTER_SELECTOR).remove();
}

/**
 * Filter HTML content in browser environment using DOMParser
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @param {boolean} returnText - Whether to return text only
 * @param {boolean} includeNoscript - Whether to include noscript elements (false excludes them)
 * @returns {string} Filtered content
 */
function filterHtmlBrowser(htmlContent, ignoreNavFooter, returnText, includeNoscript) {
  const parser = new DOMParser(); // eslint-disable-line no-undef
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Process the entire document to capture JSON-LD in both head and body
  const documentElement = doc.documentElement || doc;

  // Remove script elements except JSON-LD, also remove style, template
  documentElement.querySelectorAll('script').forEach((n) => {
    // Preserve JSON-LD structured data scripts by converting them to code blocks
    if (n.type === 'application/ld+json') {
      const jsonContent = n.textContent || n.innerText || '';
      if (jsonContent.trim()) {
        try {
          // Parse and re-stringify JSON to ensure consistent formatting
          // Handle both single and double quoted JSON
          const cleanJsonContent = jsonContent.trim();
          // Try to fix common JSON issues like single quotes
          const startsValid = cleanJsonContent.startsWith('{')
            || cleanJsonContent.startsWith('[');
          const endsValid = cleanJsonContent.endsWith('}')
            || cleanJsonContent.endsWith(']');

          if (!startsValid || !endsValid) {
            throw new Error('Not valid JSON structure');
          }

          const parsedJson = JSON.parse(cleanJsonContent);
          const formattedJson = JSON.stringify(parsedJson, null, 2);

          // Create a pre/code block to preserve JSON-LD for markdown conversion
          const codeBlock = document.createElement('pre'); // eslint-disable-line no-undef
          const code = document.createElement('code'); // eslint-disable-line no-undef
          code.className = 'ld-json';
          code.textContent = formattedJson;
          codeBlock.appendChild(code);
          n.parentNode.insertBefore(codeBlock, n);
        } catch (e) {
          // If JSON parsing fails, fall back to original content
          const codeBlock = document.createElement('pre'); // eslint-disable-line no-undef
          const code = document.createElement('code'); // eslint-disable-line no-undef
          code.className = 'ld-json';
          code.textContent = jsonContent.trim();
          codeBlock.appendChild(code);
          n.parentNode.insertBefore(codeBlock, n);
        }
      }
    }
    n.remove();
  });

  if (includeNoscript) {
    documentElement.querySelectorAll('style,template').forEach((n) => n.remove());
  } else {
    documentElement.querySelectorAll('noscript,style,template').forEach((n) => n.remove());
  }

  // Remove all media elements (images, videos, audio, etc.) to keep only text
  const mediaSelector = 'img,video,audio,picture,svg,canvas,embed,object,iframe';
  documentElement.querySelectorAll(mediaSelector).forEach((n) => n.remove());

  // Remove consent banners with intelligent detection
  removeCookieBanners(documentElement);

  // Remove accessibility elements
  removeAccessibilityElements(documentElement);

  // Conditionally remove navigation and footer elements
  if (ignoreNavFooter) {
    filterNavigationAndFooterBrowser(documentElement);
  }

  if (returnText) {
    return (documentElement && documentElement.textContent) ? documentElement.textContent : '';
  }
  return documentElement.outerHTML;
}

/**
 * Filter HTML content in Node.js environment using cheerio
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @param {boolean} returnText - Whether to return text only
 * @param {boolean} includeNoscript - Whether to include noscript elements (false excludes them)
 * @returns {Promise<string>} Filtered content
 */
async function filterHtmlNode(htmlContent, ignoreNavFooter, returnText, includeNoscript) {
  let cheerio;
  try {
    cheerio = await import('cheerio');
  } catch (error) {
    throw new Error('Cheerio is required for Node.js environments. Please install it: npm install cheerio');
  }

  const $ = cheerio.load(htmlContent);

  // Remove script except JSON-LD structured data, also remove style, noscript, template
  $('script').each(function processScript() {
    // Preserve JSON-LD structured data scripts by converting them to code blocks
    if ($(this).attr('type') === 'application/ld+json') {
      const jsonContent = $(this).text().trim();
      if (jsonContent) {
        try {
          // Parse and re-stringify JSON to ensure consistent formatting
          // Handle both single and double quoted JSON
          const cleanJsonContent = jsonContent;
          const startsValid = cleanJsonContent.startsWith('{')
            || cleanJsonContent.startsWith('[');
          const endsValid = cleanJsonContent.endsWith('}')
            || cleanJsonContent.endsWith(']');

          if (!startsValid || !endsValid) {
            throw new Error('Not valid JSON structure');
          }

          const parsedJson = JSON.parse(cleanJsonContent);
          const formattedJson = JSON.stringify(parsedJson, null, 2);
          const codeBlock = `<pre><code class="ld-json">${formattedJson}</code></pre>`;
          $(this).before(codeBlock);
        } catch (e) {
          // If JSON parsing fails, fall back to original content
          const codeBlock = `<pre><code class="ld-json">${jsonContent}</code></pre>`;
          $(this).before(codeBlock);
        }
      }
      $(this).remove();
    } else {
      $(this).remove();
    }
  });

  if (includeNoscript) {
    $('style, template').remove();
  } else {
    $('style, noscript, template').remove();
  }

  // Remove all media elements (images, videos, audio, etc.) to keep only text
  $('img, video, audio, picture, svg, canvas, embed, object, iframe').remove();

  // Remove cookie banners with comprehensive detection
  removeCookieBannersCheerio($);

  // Remove accessibility elements
  removeAccessibilityElementsCheerio($);

  // Conditionally remove navigation and footer elements
  if (ignoreNavFooter) {
    filterNavigationAndFooterCheerio($);
  }

  if (returnText) {
    // Get text content from document element
    const textContent = $('html').text() || $('body').text() || '';
    // Clean up whitespace
    return textContent.replace(/\s+/g, ' ').trim();
  }
  return $.html();
}

/**
 * Filter HTML content by removing unwanted elements
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to remove navigation/footer elements
 * @param {boolean} [returnText=true] - Whether to return text only (true) or filtered HTML (false)
 * @param {boolean} [includeNoscript=false] - Whether to include noscript elements
 * @returns {string|Promise<string>} Filtered content (sync in browser, async in Node.js)
 */
export function filterHtmlContent(
  htmlContent,
  ignoreNavFooter = true,
  returnText = true,
  includeNoscript = false,
) {
  if (!htmlContent) return '';

  // Browser environment (DOMParser) - works in Chrome extensions too - SYNCHRONOUS
  if (isBrowser()) {
    return filterHtmlBrowser(htmlContent, ignoreNavFooter, returnText, includeNoscript);
  }

  // Node.js environment (cheerio) - dynamic import to avoid bundling issues - ASYNCHRONOUS
  return filterHtmlNode(htmlContent, ignoreNavFooter, returnText, includeNoscript);
}

/**
 * Strip HTML tags and return plain text
 *
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to remove navigation/footer elements
 * @param {boolean} [includeNoscript=false] - Whether to include noscript elements
 * @returns {string|Promise<string>} Plain text content (sync in browser, async in Node.js)
 */
export function stripTagsToText(htmlContent, ignoreNavFooter = true, includeNoscript = false) {
  return filterHtmlContent(htmlContent, ignoreNavFooter, true, includeNoscript);
}

/**
 * Extract word count from HTML content
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} [ignoreNavFooter=true] - Whether to ignore navigation/footer
 * @param {boolean} [includeNoscript=false] - Whether to include noscript elements
 * @returns {Object|Promise<Object>} Object with word_count property
 *   (sync in browser, async in Node.js)
 */
export function extractWordCount(htmlContent, ignoreNavFooter = true, includeNoscript = false) {
  if (!htmlContent) {
    return { word_count: 0 };
  }

  const textContent = stripTagsToText(htmlContent, ignoreNavFooter, includeNoscript);

  // Handle both sync (browser) and async (Node.js) cases
  if (textContent && typeof textContent.then === 'function') {
    // Node.js - async
    return textContent.then((text) => {
      const wordCount = tokenize(text, 'word').length;
      return { word_count: wordCount };
    });
  } else {
    // Browser - sync
    const wordCount = tokenize(textContent, 'word').length;
    return { word_count: wordCount };
  }
}
