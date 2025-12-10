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

import { tracingFetch, SPACECAT_USER_AGENT } from '../tracing-fetch.js';
import { isValidUrl } from '../functions.js';

/**
 * Confidence levels used in bot blocker detection:
 * - 1.0 (ABSOLUTE): Site responds successfully with 200 OK - definitively crawlable
 * - 0.99 (HIGH): Known bot blocker signature detected (Cloudflare cf-ray, Imperva x-iinfo/x-cdn)
 * - 0.95 (MEDIUM): HTTP/2 protocol errors indicating potential blocking
 * - 0.5: Unknown status code without known blocker signature (e.g., 403 without headers)
 * - 0.3: Unknown error occurred during request
 *
 * Only detections with confidence >= 0.95 should be considered reliable indicators of bot blocking.
 * Lower confidence values indicate uncertain situations that may require manual investigation.
 */
const CONFIDENCE_HIGH = 0.99;
const CONFIDENCE_MEDIUM = 0.95;
const CONFIDENCE_ABSOLUTE = 1.0;
const DEFAULT_TIMEOUT = 5000;

function analyzeResponse(response) {
  const { status, headers } = response;

  if (status === 403 && headers.get('cf-ray')) {
    return {
      crawlable: false,
      type: 'cloudflare',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 403 && (headers.get('x-iinfo') || headers.get('x-cdn') === 'Incapsula')) {
    return {
      crawlable: false,
      type: 'imperva',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 200) {
    return {
      crawlable: true,
      type: 'none',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  return {
    crawlable: true,
    type: 'unknown',
    confidence: 0.5,
  };
}

function analyzeError(error) {
  if (error.code === 'NGHTTP2_INTERNAL_ERROR' || error.code === 'ERR_HTTP2_STREAM_ERROR') {
    return {
      crawlable: false,
      type: 'http2-block',
      confidence: CONFIDENCE_MEDIUM,
    };
  }

  return {
    crawlable: true,
    type: 'unknown',
    confidence: 0.3,
  };
}

/**
 * Detects bot blocker technology on a website.
 * Makes a single HEAD request and analyzes the response for blocking patterns.
 *
 * Currently detects:
 * - Cloudflare bot blocking (403 + cf-ray header)
 * - Imperva/Incapsula (403 + x-iinfo or x-cdn: Incapsula header)
 * - HTTP/2 stream errors (NGHTTP2_INTERNAL_ERROR, ERR_HTTP2_STREAM_ERROR)
 *
 * @param {Object} config - Configuration object
 * @param {string} config.baseUrl - The base URL to check
 * @param {number} [config.timeout=5000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Detection result with:
 *   - crawlable {boolean}: Whether the site can be crawled by bots
 *   - type {string}: Blocker type ('cloudflare', 'imperva', 'http2-block', 'none', 'unknown')
 *   - confidence {number}: Confidence level (0.0-1.0, see confidence level constants)
 * @throws {Error} If baseUrl is invalid
 */
export async function detectBotBlocker({ baseUrl, timeout = DEFAULT_TIMEOUT }) {
  if (!baseUrl || !isValidUrl(baseUrl)) {
    throw new Error('Invalid baseUrl');
  }

  try {
    const response = await tracingFetch(baseUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': SPACECAT_USER_AGENT,
      },
      signal: AbortSignal.timeout(timeout),
    });

    return analyzeResponse(response);
  } catch (error) {
    return analyzeError(error);
  }
}
