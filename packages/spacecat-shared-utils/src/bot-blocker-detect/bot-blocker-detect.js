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
 * - 0.99 (HIGH): Known bot blocker signature detected
 *   (Cloudflare, Imperva, Akamai, Fastly, CloudFront)
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

/**
 * SpaceCat bot identification constants
 */
export const SPACECAT_BOT_USER_AGENT = 'Spacecat/1.0';

/**
 * Gets SpaceCat bot IPs from environment variable
 * @param {string} ipsString - Comma-separated IPs (from env/secrets) - REQUIRED
 * @returns {Array<string>} Array of IP addresses
 * @throws {Error} If ipsString is not provided
 */
export function getSpacecatBotIps(ipsString) {
  if (!ipsString) {
    throw new Error('SPACECAT_BOT_IPS environment variable is required but not set');
  }

  return ipsString.split(',').map((ip) => ip.trim()).filter((ip) => ip);
}

/**
 * Formats allowlist message with current bot IPs
 * @param {string} botIps - Comma-separated IPs from secrets - REQUIRED
 * @returns {object} Formatted message with IPs and user-agent
 * @throws {Error} If botIps is not provided
 */
export function formatAllowlistMessage(botIps) {
  const ips = getSpacecatBotIps(botIps);

  return {
    title: 'To allowlist SpaceCat bot:',
    ips,
    userAgent: SPACECAT_BOT_USER_AGENT,
  };
}

/**
 * HTML patterns for detecting challenge pages
 */
const CHALLENGE_PATTERNS = {
  cloudflare: [
    /Checking your browser/i,
    /Just a moment\.\.\./i,
    /Verifying you are human/i,
    /Please wait.*CloudFlare/i,
    /cf-turnstile/i,
    /challenge-platform/i,
    /cf-chl-widget/i, // Cloudflare challenge widget
    /ray\s*id.*cloudflare/i, // Cloudflare Ray ID in error pages
    /__cf_chl_tk/i, // Cloudflare challenge token
    /cloudflare.*security/i,
    /attention required.*cloudflare/i,
  ],
  imperva: [
    /_Incapsula_Resource/i,
    /Incapsula incident ID/i,
    /incap_ses/i, // Imperva session cookie
    /visid_incap/i, // Imperva visitor ID
  ],
  akamai: [
    /Access Denied.*Akamai/i,
    /Reference.*Akamai/i,
  ],
  general: [
    /captcha/i,
    /human verification/i,
    /recaptcha/i,
    /hcaptcha/i,
    /datadome/i,
    /dd-request-id/i,
  ],
};

/**
 * Analyzes response for bot protection indicators
 * @param {Object} response - Response object with status and headers
 * @param {string} [html] - Optional HTML content for deeper analysis
 * @returns {Object} Detection result
 */
function analyzeResponse(response, html = null) {
  const { status, headers } = response;

  // Check for CDN/blocker infrastructure presence (lazy evaluation for performance)
  const hasCloudflare = () => headers.get('cf-ray') || headers.get('server') === 'cloudflare';
  const hasImperva = () => headers.get('x-iinfo') || headers.get('x-cdn') === 'Incapsula';
  const hasAkamai = () => headers.get('x-akamai-request-id')
    || headers.get('x-akamai-session-id')
    || headers.get('server')?.includes('AkamaiGHost');
  const hasFastly = () => headers.get('x-served-by')?.startsWith('cache-')
    || headers.get('fastly-io-info');
  const hasCloudFront = () => headers.get('x-amz-cf-id')
    || headers.get('x-amz-cf-pop')
    || headers.get('via')?.includes('CloudFront');

  // Check HTML content for challenge page patterns (if HTML provided)
  const htmlHasChallenge = (patterns) => {
    if (!html) return false;
    return patterns.some((pattern) => pattern.test(html));
  };

  // Active blocking (403 status with known blocker)
  if (status === 403 && hasCloudflare()) {
    return {
      crawlable: false,
      type: 'cloudflare',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 403 && hasImperva()) {
    return {
      crawlable: false,
      type: 'imperva',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 403 && hasAkamai()) {
    return {
      crawlable: false,
      type: 'akamai',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 403 && hasFastly()) {
    return {
      crawlable: false,
      type: 'fastly',
      confidence: CONFIDENCE_HIGH,
    };
  }

  if (status === 403 && hasCloudFront()) {
    return {
      crawlable: false,
      type: 'cloudfront',
      confidence: CONFIDENCE_HIGH,
    };
  }

  // Success with known infrastructure present (infrastructure detected but allowing requests)
  if (status === 200 && hasCloudflare()) {
    // Check if HTML contains challenge page (even though status is 200)
    if (htmlHasChallenge(CHALLENGE_PATTERNS.cloudflare)) {
      return {
        crawlable: false,
        type: 'cloudflare',
        confidence: CONFIDENCE_HIGH,
        reason: 'Challenge page detected despite 200 status',
      };
    }

    return {
      crawlable: true,
      type: 'cloudflare-allowed',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  if (status === 200 && hasImperva()) {
    if (htmlHasChallenge(CHALLENGE_PATTERNS.imperva)) {
      return {
        crawlable: false,
        type: 'imperva',
        confidence: CONFIDENCE_HIGH,
        reason: 'Challenge page detected despite 200 status',
      };
    }
    return {
      crawlable: true,
      type: 'imperva-allowed',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  if (status === 200 && hasAkamai()) {
    if (htmlHasChallenge(CHALLENGE_PATTERNS.akamai)) {
      return {
        crawlable: false,
        type: 'akamai',
        confidence: CONFIDENCE_HIGH,
        reason: 'Challenge page detected despite 200 status',
      };
    }
    return {
      crawlable: true,
      type: 'akamai-allowed',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  if (status === 200 && hasFastly()) {
    return {
      crawlable: true,
      type: 'fastly-allowed',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  if (status === 200 && hasCloudFront()) {
    return {
      crawlable: true,
      type: 'cloudfront-allowed',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  // Success with no known infrastructure
  if (status === 200) {
    // Still check for generic challenge patterns
    if (htmlHasChallenge(CHALLENGE_PATTERNS.general)) {
      return {
        crawlable: false,
        type: 'unknown',
        confidence: 0.7,
        reason: 'Generic challenge patterns detected',
      };
    }
    return {
      crawlable: true,
      type: 'none',
      confidence: CONFIDENCE_ABSOLUTE,
    };
  }

  // Potential CDN/protection blocked the request
  if (status === 403) {
    return {
      crawlable: false,
      type: 'unknown',
      confidence: 0.7,
      reason: 'HTTP 403 Forbidden - access denied',
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
 * - Akamai (403 + x-akamai-request-id or related headers)
 * - Fastly (403 + x-served-by or fastly-io-info headers)
 * - AWS CloudFront (403 + x-amz-cf-id or via: CloudFront header)
 * - HTTP/2 stream errors (NGHTTP2_INTERNAL_ERROR, ERR_HTTP2_STREAM_ERROR)
 *
 * Also detects infrastructure presence on successful requests (200 OK):
 * - Returns 'cloudflare-allowed', 'imperva-allowed', 'akamai-allowed',
 *   'fastly-allowed', or 'cloudfront-allowed' when infrastructure is present
 *   but allowing the request through
 *
 * @param {Object} config - Configuration object
 * @param {string} config.baseUrl - The base URL to check
 * @param {number} [config.timeout=5000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Detection result with:
 *   - crawlable {boolean}: Whether the site can be crawled by bots
 *   - type {string}: Blocker type ('cloudflare', 'imperva', 'akamai', 'fastly',
 *     'cloudfront', 'http2-block', 'cloudflare-allowed', 'imperva-allowed',
 *     'akamai-allowed', 'fastly-allowed', 'cloudfront-allowed', 'none', 'unknown')
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

/**
 * Analyzes already-fetched response data for bot protection.
 * Used by content scraper to analyze Puppeteer results without making another request.
 *
 * @param {Object} data - Response data to analyze
 * @param {number} data.status - HTTP status code
 * @param {Object} data.headers - Response headers (plain object or Headers object)
 * @param {string} [data.html] - Optional HTML content for challenge page detection
 * @returns {Object} Detection result (same format as detectBotBlocker)
 */
export function analyzeBotProtection({ status, headers, html }) {
  // Convert headers to Headers object if plain object
  const headersObj = headers instanceof Headers
    ? headers
    : new Headers(Object.entries(headers || {}));

  const response = {
    status,
    headers: headersObj,
  };

  return analyzeResponse(response, html);
}
