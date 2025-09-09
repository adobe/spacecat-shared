/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { context as h2, h1 } from '@adobe/fetch';
import { SPACECAT_USER_AGENT } from './tracing-fetch.js';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();
/**
 * Prepends 'https://' schema to the URL if it's not already present.
 * @param {string} url - The URL to modify.
 * @returns {string} - The URL with 'https://' schema prepended.
 */
function prependSchema(url) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

/**
 * Strips the port number from the end of the URL.
 * @param {string} url - The URL to modify.
 * @returns {string} - The URL with the port removed.
 */
function stripPort(url) {
  return url.replace(/:\d{1,5}(\/|$)/, '');
}

/**
 * Strips the trailing dot from the end of the URL.
 * @param {string} url - The URL to modify.
 * @returns {string} - The URL with the trailing dot removed.
 */
function stripTrailingDot(url) {
  return url.endsWith('.') ? url.slice(0, -1) : url;
}

/**
 * Strips the trailing slash from the end of the URL if the path is '/'.
 * @param {string} url - The URL to modify.
 * @returns {string} - The URL with the trailing slash removed.
 */
function stripTrailingSlash(url) {
  // remove the scheme (if any) to simplify the slash check
  const schemelessUrl = url.split('://')[1] || url;

  return schemelessUrl.endsWith('/') && schemelessUrl.split('/').length === 2
    ? url.slice(0, -1)
    : url;
}

/**
 * Strips 'www.' from the beginning of the URL if present.
 * @param {string} url - The URL to modify.
 * @returns {string} - The URL with 'www.' removed.
 */
function stripWWW(url) {
  const regex = /^(https?:\/\/)?(www\.)?/;
  // Replace "www." with an empty string, preserving the schema if present
  return url.replace(regex, (match, schema) => (schema || ''));
}

/**
 * Composes a base URL by applying a series of transformations to the given domain.
 * @param {string} domain - The domain to compose the base URL from.
 * @returns {string} - The composed base URL.
 */
function composeBaseURL(domain) {
  let baseURL = domain.toLowerCase();
  baseURL = stripPort(baseURL);
  baseURL = stripTrailingDot(baseURL);
  baseURL = stripTrailingSlash(baseURL);
  baseURL = stripWWW(baseURL);
  baseURL = prependSchema(baseURL);
  return baseURL;
}

/**
 * Composes an audit URL by applying a series of transformations to the given url.
 * @param {string} url - The url to compose the audit URL from.
 * @param {string} [userAgent] - Optional user agent to use in the audit URL.
 * @returns a promise that resolves the composed audit URL.
 */
async function composeAuditURL(url, userAgent) {
  const urlWithScheme = prependSchema(url);

  const headers = {};
  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  const resp = await fetch(urlWithScheme, {
    method: 'GET',
    headers,
  });
  const finalUrl = resp.url.split('://')[1];
  return stripTrailingSlash(finalUrl);
}

/**
 * Ensures the URL is HTTPS.
 * @param {string} url - The URL to ensure is HTTPS.
 * @returns {string} The HTTPS URL.
 */
function ensureHttps(url) {
  const urlObj = new URL(url);
  urlObj.protocol = 'https';
  return urlObj.toString();
}

/**
 * Gets spacecat HTTP headers with appropriate user agent for the request type
 * @returns {Object} - HTTP headers object
 */
function getSpacecatRequestHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml,text/css,application/javascript,text/javascript;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://www.adobe.com/',
    'User-Agent': SPACECAT_USER_AGENT,
  };
}

/**
 * Resolve canonical URL for a given URL string by following redirect chain.
 * @param {string} urlString - The URL string to normalize.
 * @param {string} method - HTTP method to use ('HEAD' or 'GET').
 * @returns {Promise<string|null>} A Promise that resolves to the canonical URL or null if failed.
 */
async function resolveCanonicalUrl(urlString, method = 'HEAD') {
  const headers = getSpacecatRequestHeaders();
  let resp;

  try {
    resp = await fetch(urlString, { headers, method });

    if (resp.ok) {
      return ensureHttps(resp.url);
    }

    // Handle redirect chains
    if (urlString !== resp.url) {
      return resolveCanonicalUrl(resp.url, method);
    }

    if (method === 'HEAD') {
      return resolveCanonicalUrl(urlString, 'GET');
    }

    // If the URL is not found and we've tried both HEAD and GET, return null
    return null;
  } catch {
    // If HEAD failed with network error and we haven't tried GET yet, retry with GET
    if (method === 'HEAD') {
      return resolveCanonicalUrl(urlString, 'GET');
    }

    // For all errors (both HTTP status and network), return null
    return null;
  }
}

/**
 * Normalize a URL by trimming whitespace and handling trailing slashes
 * @param {string} url - The URL to normalize
 * @returns {string} The normalized URL
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return url;
  // Trim whitespace from beginning and end
  let normalized = url.trim();
  // Handle trailing slashes - normalize multiple trailing slashes to single slash
  // or no slash depending on whether it's a root path
  if (normalized.endsWith('/')) {
    // Remove all trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    // Add back a single slash if it's a root path (domain only)
    const parts = normalized.split('/');
    if (parts.length === 1 || (parts.length === 2 && parts[1] === '')) {
      normalized += '/';
    }
  }
  return normalized;
}

/**
 * Normalize a pathname by removing trailing slashes
 * @param {string} pathname - The pathname to normalize
 * @returns {string} The normalized pathname
 */
function normalizePathname(pathname) {
  if (!pathname || typeof pathname !== 'string') return pathname;
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

// Export for testing purposes
export { normalizePathname };

/**
 * Check if a URL matches any of the filter URLs by comparing pathnames
 * @param {string} url - URL to check (format: https://domain.com/path)
 * @param {string[]} filterUrls - Array of filter URLs (format: domain.com/path)
 * @returns {boolean} True if URL matches any filter URL, false if any URL is invalid
 */
function urlMatchesFilter(url, filterUrls) {
  if (!filterUrls || filterUrls.length === 0) return true;
  try {
    // Normalize the input URL
    const normalizedInputUrl = normalizeUrl(url);
    const normalizedUrl = prependSchema(normalizedInputUrl);
    const urlPath = normalizePathname(new URL(normalizedUrl).pathname);
    return filterUrls.some((filterUrl) => {
      try {
        // Normalize each filter URL
        const normalizedInputFilterUrl = normalizeUrl(filterUrl);
        const normalizedFilterUrl = prependSchema(normalizedInputFilterUrl);
        const filterPath = normalizePathname(new URL(normalizedFilterUrl).pathname);
        return urlPath === filterPath;
      } catch (error) {
        // If any filter URL is invalid, skip it and continue checking others
        /* eslint-disable-next-line no-console */
        console.warn(`Invalid filter URL: ${filterUrl}`, error.message);
        return false;
      }
    });
  } catch (error) {
    // If the main URL is invalid, return false
    /* eslint-disable-next-line no-console */
    console.warn(`Invalid URL: ${url}`, error.message);
    return false;
  }
}

export {
  ensureHttps,
  getSpacecatRequestHeaders,
  resolveCanonicalUrl,
  composeBaseURL,
  composeAuditURL,
  prependSchema,
  stripPort,
  stripTrailingDot,
  stripTrailingSlash,
  stripWWW,
  urlMatchesFilter,
};
