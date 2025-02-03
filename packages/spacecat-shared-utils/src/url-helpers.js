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

async function composeAuditURL(url) {
  const urlWithScheme = prependSchema(url);
  const resp = await fetch(urlWithScheme, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  const finalUrl = resp.url.split('://')[1];
  return stripTrailingSlash(finalUrl);
}

export {
  composeBaseURL,
  composeAuditURL,
  prependSchema,
  stripPort,
  stripTrailingDot,
  stripTrailingSlash,
  stripWWW,
};
