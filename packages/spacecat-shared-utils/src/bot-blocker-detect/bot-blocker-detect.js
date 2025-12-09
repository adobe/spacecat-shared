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
 * @param {Object} config - Configuration object
 * @param {string} config.baseUrl - The base URL to check
 * @param {number} [config.timeout=5000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Detection result with crawlable status, type, and confidence
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
