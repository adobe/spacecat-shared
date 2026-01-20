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

import { hasText } from '@adobe/spacecat-shared-utils';

/**
 * Helper function to wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Makes an HTTP request with retry logic
 * Retries until max retries are exhausted or x-edge-optimize-cache header is present
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelayMs - Delay between retries in milliseconds
 * @param {Object} log - Logger instance
 * @param {string} fetchType - Context for logging (e.g., "optimized" or "original")
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(url, options, maxRetries, retryDelayMs, log, fetchType) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      log.debug(`Retry attempt ${attempt}/${maxRetries} for ${fetchType} HTML`);

      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, options);

      log.debug(`Response status (attempt ${attempt}): ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check for x-edge-optimize-cache header - if present, stop retrying
      const cacheHeader = response.headers.get('x-edge-optimize-cache');
      if (cacheHeader) {
        log.debug(`Cache header found (x-edge-optimize-cache: ${cacheHeader}), stopping retry logic`);
        return response;
      }

      // If no cache header and we haven't exhausted retries, continue
      if (attempt < maxRetries + 1) {
        log.debug(`No cache header found on attempt ${attempt}, will retry...`);
        // Wait before retrying
        log.debug(`Waiting ${retryDelayMs}ms before retry...`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(retryDelayMs);
      } else {
        // Last attempt without cache header - throw error
        log.error(`Max retries (${maxRetries}) exhausted without cache header`);
        throw new Error(`Cache header (x-edge-optimize-cache) not found after ${maxRetries} retries`);
      }
    } catch (error) {
      log.warn(`Attempt ${attempt} failed for ${fetchType} HTML, error: ${error.message}`);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries + 1) {
        throw error;
      }

      // Wait before retrying
      log.debug(`Waiting ${retryDelayMs}ms before retry...`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs);
    }
  }
  /* c8 ignore next */
  throw new Error(`Failed to fetch ${fetchType} HTML after ${maxRetries} retries`);
}

/**
 * Fetches HTML content from edge with warmup call and retry logic
 * Makes an initial warmup call, waits, then makes the actual call with retries
 * @param {string} url - Full URL to fetch
 * @param {string} apiKey - Edge Optimize API key
 * @param {string} forwardedHost - Host to forward in x-forwarded-host header
 * @param {string} edgeUrl - Edge URL
 * @param {boolean} isOptimized - Whether to fetch optimized HTML (with preview param)
 * @param {Object} log - Logger instance
 * @param {Object} options - Additional options
 * @param {number} options.warmupDelayMs - Delay after warmup call (default: 2000ms)
 * @param {number} options.maxRetries - Maximum number of retries for actual call (default: 2)
 * @param {number} options.retryDelayMs - Delay between retries (default: 1000ms)
 * @returns {Promise<string>} - HTML content
 * @throws {Error} - If validation fails or fetch fails after retries
 */
export async function fetchHtmlWithWarmup(
  url,
  apiKey,
  forwardedHost,
  edgeUrl,
  log,
  isOptimized = false,
  options = {},
) {
  // Validate required parameters
  if (!hasText(url)) {
    throw new Error('URL is required for fetching HTML');
  }

  if (!hasText(apiKey)) {
    throw new Error('Edge Optimize API key is required for fetching HTML');
  }

  if (!hasText(forwardedHost)) {
    throw new Error('Forwarded host is required for fetching HTML');
  }

  if (!hasText(edgeUrl)) {
    throw new Error('TOKOWAKA_EDGE_URL is not configured');
  }

  // Default options
  const {
    warmupDelayMs = 2000,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options;

  const fetchType = isOptimized ? 'optimized' : 'original';

  // Parse the URL to extract path and construct full URL
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname;
  let fullUrl = `${edgeUrl}${urlPath}`;

  const headers = {
    'x-forwarded-host': forwardedHost,
    'x-edge-optimize-api-key': apiKey,
    'x-edge-optimize-url': urlPath,
  };

  if (isOptimized) {
    // Add tokowakaPreview param for optimized HTML
    fullUrl = `${fullUrl}?tokowakaPreview=true`;
    headers['x-edge-optimize-url'] = `${urlPath}?tokowakaPreview=true`;
  }

  const fetchOptions = {
    method: 'GET',
    headers,
  };

  try {
    // Warmup call (no retry logic for warmup)
    log.debug(`Making warmup call for ${fetchType} HTML with URL: ${fullUrl}`);

    const warmupResponse = await fetch(fullUrl, fetchOptions);

    log.debug(`Warmup response status: ${warmupResponse.status} ${warmupResponse.statusText}`);
    // Consume the response body to free up the connection
    await warmupResponse.text();
    log.debug(`Warmup call completed, waiting ${warmupDelayMs}ms...`);

    // Wait before actual call
    await sleep(warmupDelayMs);

    // Actual call with retry logic
    log.debug(`Making actual call for ${fetchType} HTML (max ${maxRetries} retries) with URL: ${fullUrl}`);

    const response = await fetchWithRetry(
      fullUrl,
      fetchOptions,
      maxRetries,
      retryDelayMs,
      log,
      fetchType,
    );

    const html = await response.text();
    log.debug(`Successfully fetched ${fetchType} HTML (${html.length} bytes)`);
    return html;
  } catch (error) {
    const errorMsg = `Failed to fetch ${fetchType} HTML after ${maxRetries} retries: ${error.message}`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export function calculateForwardedHost(url, logger = console) {
  try {
    const urlObj = new URL(url);
    const { hostname } = urlObj;

    // If hostname already starts with www., keep it as is
    if (hostname.startsWith('www.')) {
      logger.debug(`Forwarded host: ${hostname}`);
      return hostname;
    }

    // Count dots to determine if it's a bare domain or has a subdomain
    const dotCount = (hostname.match(/\./g) || []).length;

    // If only 1 dot (bare domain like example.com), prepend www.
    // If 2+ dots (subdomain like subdomain.example.com), keep as is
    const forwardedHost = dotCount === 1 ? `www.${hostname}` : hostname;

    logger.debug(`Forwarded host: ${forwardedHost}`);
    return forwardedHost;
  } catch (error) {
    logger.error(`Error calculating forwarded host from URL ${url}: ${error.message}`);
    throw new Error(`Error calculating forwarded host from URL ${url}: ${error.message}`);
  }
}
