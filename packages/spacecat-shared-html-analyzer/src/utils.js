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
 * Utility functions for the HTML visibility analyzer
 */

/**
 * Generate DJB2 hash for content comparison
 * @param {string} str - String to hash
 * @returns {string} Hex hash string
 */
export function hashDJB2(str) {
  if (!str) return '';
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  // eslint-disable-next-line no-bitwise
  return (h >>> 0).toString(16);
}

/**
 * Format percentage with 1 decimal place
 * @param {number} n - Number to format as percentage
 * @returns {string} Formatted percentage string
 */
export function pct(n) {
  return (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '–');
}

/**
 * Format number to K/M format for readability
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumberToK(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  } else if (num >= 10000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
}

/**
 * Check if code is running in browser environment
 * @returns {boolean} True if in browser
 */
export function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
