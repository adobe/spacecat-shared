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

// Navigation and footer selectors for content filtering
const navigationSelectors = [
  'nav', 'header', 'footer',
  '.nav', '.navigation', '.navbar', '.nav-bar', '.menu', '.main-menu',
  '.header', '.site-header', '.page-header', '.top-header',
  '.footer', '.site-footer', '.page-footer', '.bottom-footer',
  '.breadcrumb', '.breadcrumbs',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  // Common class patterns
  '.navigation-wrapper', '.nav-wrapper', '.header-wrapper', '.footer-wrapper',
  '.site-navigation', '.primary-navigation', '.secondary-navigation',
  '.top-nav', '.bottom-nav', '.sidebar-nav',
  // ID selectors for common navigation/footer elements
  '#nav', '#navigation', '#navbar', '#header', '#footer', '#menu', '#main-menu',
  '#site-header', '#site-footer', '#page-header', '#page-footer',
];

/**
 * Remove navigation and footer elements (browser environment)
 * @param {Element} element - DOM element to filter
 */
function filterNavigationAndFooterBrowser(element) {
  const allSelectors = navigationSelectors.join(',');
  const elements = element.querySelectorAll(allSelectors);
  elements.forEach((el) => el.remove());
}

/**
 * Remove navigation and footer elements (Node.js environment)
 * @param {CheerioAPI} $ - Cheerio instance
 */
function filterNavigationAndFooterCheerio($) {
  const allSelectors = navigationSelectors.join(',');
  $(allSelectors).remove();
}

/**
 * Filter HTML content in browser environment using DOMParser
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @param {boolean} returnText - Whether to return text only
 * @returns {string} Filtered content
 */
function filterHtmlBrowser(htmlContent, ignoreNavFooter, returnText) {
  const parser = new DOMParser(); // eslint-disable-line no-undef
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Get the body element, if it doesn't exist, use the entire document
  const bodyElement = doc.body || doc.documentElement;

  // Always remove script, style, noscript, template elements
  bodyElement.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());

  // Remove all media elements (images, videos, audio, etc.) to keep only text
  bodyElement.querySelectorAll('img,video,audio,picture,svg,canvas,embed,object,iframe')
    .forEach((n) => n.remove());

  // Conditionally remove navigation and footer elements
  if (ignoreNavFooter) {
    filterNavigationAndFooterBrowser(bodyElement);
  }

  if (returnText) {
    return (bodyElement && bodyElement.textContent) ? bodyElement.textContent : '';
  }
  return bodyElement.outerHTML;
}

/**
 * Filter HTML content in Node.js environment using cheerio
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @param {boolean} returnText - Whether to return text only
 * @returns {Promise<string>} Filtered content
 */
async function filterHtmlNode(htmlContent, ignoreNavFooter, returnText) {
  let cheerio;
  try {
    cheerio = await import('cheerio');
  } catch (error) {
    throw new Error('Cheerio is required for Node.js environments. Please install it: npm install cheerio');
  }

  const $ = cheerio.load(htmlContent);

  // Always remove script, style, noscript, template tags
  $('script, style, noscript, template').remove();

  // Remove all media elements (images, videos, audio, etc.) to keep only text
  $('img, video, audio, picture, svg, canvas, embed, object, iframe').remove();

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
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @param {boolean} returnText - Whether to return text only (true) or filtered HTML (false)
 * @returns {string|Promise<string>} Filtered content (sync in browser, async in Node.js)
 */
export function filterHtmlContent(htmlContent, ignoreNavFooter = true, returnText = true) {
  if (!htmlContent) return '';

  // Browser environment (DOMParser) - works in Chrome extensions too - SYNCHRONOUS
  if (isBrowser()) {
    return filterHtmlBrowser(htmlContent, ignoreNavFooter, returnText);
  }

  // Node.js environment (cheerio) - dynamic import to avoid bundling issues - ASYNCHRONOUS
  return filterHtmlNode(htmlContent, ignoreNavFooter, returnText);
}

/**
 * Strip HTML tags and return plain text
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to remove navigation/footer elements
 * @returns {string|Promise<string>} Plain text content (sync in browser, async in Node.js)
 */
export function stripTagsToText(htmlContent, ignoreNavFooter = true) {
  return filterHtmlContent(htmlContent, ignoreNavFooter, true);
}

/**
 * Extract word count from HTML content
 * @param {string} htmlContent - Raw HTML content
 * @param {boolean} ignoreNavFooter - Whether to ignore navigation/footer
 * @returns {Object|Promise<Object>} Object with word_count property
 *   (sync in browser, async in Node.js)
 */
export function extractWordCount(htmlContent, ignoreNavFooter = true) {
  if (!htmlContent) {
    return { word_count: 0 };
  }

  const textContent = stripTagsToText(htmlContent, ignoreNavFooter);

  // Handle both sync (browser) and async (Node.js) cases
  if (textContent && typeof textContent.then === 'function') {
    // Node.js - async
    return textContent.then((text) => {
      const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
      return { word_count: words.length };
    });
  } else {
    // Browser - sync
    const words = textContent.trim().split(/\s+/).filter((word) => word.length > 0);
    return { word_count: words.length };
  }
}
