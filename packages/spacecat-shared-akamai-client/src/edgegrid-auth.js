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

import { createHash, createHmac, randomUUID } from 'crypto';

// PAPI never signs a request body over this size — matches the reference
// Akamai EdgeGrid clients (akamai-edgegrid, edgegrid-python).
const MAX_BODY_BYTES = 131072;

function base64Sha256(data) {
  return createHash('sha256').update(data).digest('base64');
}

function base64HmacSha256(data, key) {
  return createHmac('sha256', key).update(data).digest('base64');
}

/**
 * EdgeGrid-compatible timestamp: "yyyyMMddTHH:mm:ss+0000" (UTC).
 * @param {Date} [date]
 * @returns {string}
 */
export function edgeGridTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}:${minutes}:${seconds}+0000`;
}

function canonicalizeHeaders(headers) {
  if (!headers) {
    return '';
  }
  return Object.entries(headers)
    .map(([name, value]) => `${name.toLowerCase()}:${String(value).trim().replace(/\s+/g, ' ')}`)
    .join('\t');
}

// The EdgeGrid spec only signs the body for POST requests — PUT (used by PAPI
// to write rule trees) is intentionally left unsigned here too, matching the
// official akamai-edgegrid and edgegrid-python reference implementations.
function contentHash(method, body) {
  if (method !== 'POST' || !body) {
    return '';
  }
  const truncated = Buffer.from(body, 'utf8').subarray(0, MAX_BODY_BYTES);
  return base64Sha256(truncated);
}

/**
 * Signs a request using Akamai's EG1-HMAC-SHA256 EdgeGrid authentication
 * scheme and returns the value for the `Authorization` header.
 *
 * @param {object} params
 * @param {string} params.method - HTTP method
 * @param {string} params.url - Full request URL, including query string
 * @param {string} params.clientToken
 * @param {string} params.clientSecret
 * @param {string} params.accessToken
 * @param {string} [params.body] - Request body, if any (only signed for POST)
 * @param {Record<string,string>} [params.headersToSign] - Headers to include
 *   in the signature, keyed by header name (rarely needed for PAPI)
 * @param {string} [params.timestamp] - Overrides the generated timestamp
 *   (mainly for tests)
 * @param {string} [params.nonce] - Overrides the generated nonce (mainly for
 *   tests)
 * @returns {string} the `Authorization` header value
 */
export function signRequest({
  method,
  url,
  clientToken,
  clientSecret,
  accessToken,
  body,
  headersToSign,
  timestamp = edgeGridTimestamp(),
  nonce = randomUUID(),
}) {
  const upperMethod = method.toUpperCase();
  const authHeaderData = `client_token=${clientToken};access_token=${accessToken};`
    + `timestamp=${timestamp};nonce=${nonce};`;
  const unsignedAuthHeader = `EG1-HMAC-SHA256 ${authHeaderData}`;

  const parsedUrl = new URL(url);
  const dataToSign = [
    upperMethod,
    parsedUrl.protocol.replace(':', ''),
    parsedUrl.host,
    parsedUrl.pathname + parsedUrl.search,
    canonicalizeHeaders(headersToSign),
    contentHash(upperMethod, body),
    unsignedAuthHeader,
  ].join('\t');

  const signingKey = base64HmacSha256(timestamp, clientSecret);
  const signature = base64HmacSha256(dataToSign, signingKey);

  return `${unsignedAuthHeader}signature=${signature}`;
}
