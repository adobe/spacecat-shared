/*
 * Copyright 2026 Adobe. All rights reserved.
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
 * Builds a URL matcher function for a given allowedRegexPatterns entry.
 *
 * - Patterns ending with `/*` use pathname prefix matching against the URL's pathname.
 *   `/products/*` matches `/products`, `/products/`, `/products/item` but NOT `/productsabc`.
 *   `/*` matches all URLs (intentional for domain-wide).
 * - All other patterns are compiled as regular expressions and matched against the **full URL
 *   string** (e.g. `https://example.com/page`). This is intentional for backward compatibility
 *   with callers that supply full-URL regexes such as `^https://example\\.com/.*`.
 *   Note: a pathname-only regex like `^/blog` will never match via this path because the URL
 *   string always starts with a scheme. Use the `/*` suffix form for pathname-only matching.
 * - Returns null for non-string, empty, or invalid-regex inputs.
 *
 * @param {string} pattern
 * @returns {((url: string) => boolean)|null}
 */
export function buildUrlMatcher(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return null;
  }
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2); // '/products/*' → '/products', '/*' → ''
    return (url) => {
      try {
        const { pathname } = new URL(url);
        // Empty prefix means '/*' — match everything
        return prefix === '' || pathname === prefix || pathname.startsWith(`${prefix}/`);
      } catch {
        return false;
      }
    };
  }
  try {
    const regex = new RegExp(pattern);
    return (url) => regex.test(url);
  } catch {
    return null;
  }
}
