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

import { tracingFetch, SPACECAT_USER_AGENT } from '@adobe/spacecat-shared-utils';
import BaseValidator from './base-validator.js';

export const ROUTING_VALIDATOR_TYPE = 'routing';
export const ROUTING_VALIDATOR_USER_AGENT = `${SPACECAT_USER_AGENT} Tokowaka-AI AdobeEdgeOptimize-AI`;
export const REQUEST_ID_HEADERS = ['x-tokowaka-request-id', 'x-edgeoptimize-request-id'];
export const FETCH_TIMEOUT_MS = 10000;
// Two retries after the first attempt (3 attempts total), waiting 4s then 8s between them.
export const RETRY_DELAYS_MS = [4000, 8000];

function hasRoutingHeader(response) {
  return REQUEST_ID_HEADERS.some((header) => response.headers.has(header));
}

function isAllowedUrl(urlStr) {
  try {
    return new URL(urlStr).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * True only for a same-protocol www<->non-www hostname swap with identical path and query —
 * the one redirect shape safe to follow automatically. Anything else (cross-path, cross-domain,
 * a protocol downgrade) is left unfollowed and classified as 'unknown' by the caller. A trailing
 * slash on a non-root path is ignored when comparing paths (e.g. '/abc' and '/abc/' count as the
 * same path) -- a real site commonly bundles www-canonicalization with trailing-slash
 * canonicalization in a single redirect, and that combination shouldn't be treated as unsafe.
 */
function isWwwNormalizationRedirect(fromUrl, toUrl) {
  let from;
  let to;
  try {
    from = new URL(fromUrl);
    to = new URL(toUrl);
  } catch {
    return false;
  }
  if (from.protocol !== to.protocol) {
    return false;
  }
  const stripTrailingSlash = (path) => (path === '/' ? path : path.replace(/\/$/, ''));
  if (stripTrailingSlash(from.pathname) !== stripTrailingSlash(to.pathname)
    || from.search !== to.search) {
    return false;
  }
  const stripWww = (host) => host.replace(/^www\./, '');
  return from.hostname !== to.hostname && stripWww(from.hostname) === stripWww(to.hostname);
}

async function cancelBody(response) {
  if (typeof response.body?.cancel !== 'function') {
    return;
  }
  await response.body.cancel().catch(() => {});
}

/**
 * Classifies an already-resolved (non-3xx) response.
 *   - routing header present (any status)      -> pass (definitive proof of correct routing)
 *   - no header, status 404                     -> unknown (could be a legitimate customer-side
 *                                                   removal, not proof routing itself is broken)
 *   - no header, any other status (2xx/4xx/5xx) -> fail
 */
function classifyResolvedResponse(response) {
  if (hasRoutingHeader(response)) {
    return { outcome: 'pass', metadata: { origin_status: response.status } };
  }
  if (response.status === 404) {
    return { outcome: 'unknown', metadata: { origin_status: response.status } };
  }
  return { outcome: 'fail', metadata: { origin_status: response.status } };
}

async function fetchOnce(url) {
  return tracingFetch(url, {
    method: 'GET',
    redirect: 'manual',
    timeout: FETCH_TIMEOUT_MS,
    headers: { 'User-Agent': ROUTING_VALIDATOR_USER_AGENT },
  });
}

/**
 * Fetches a single URL with manual redirect handling: a www-normalization redirect is followed
 * one hop further and that response classified; any other redirect (including a second
 * consecutive one) is left unfollowed and classified as 'unknown'.
 */
async function checkUrlRoutingStatus(url) {
  const res = await fetchOnce(url);
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    const { status } = res;
    await cancelBody(res);
    if (!location || !isWwwNormalizationRedirect(url, location)) {
      return { outcome: 'unknown', metadata: { origin_status: status } };
    }
    const res2 = await fetchOnce(location);
    if (res2.status >= 300 && res2.status < 400) {
      const status2 = res2.status;
      await cancelBody(res2);
      return { outcome: 'unknown', metadata: { origin_status: status2 } };
    }
    const result = classifyResolvedResponse(res2);
    await cancelBody(res2);
    return result;
  }
  const result = classifyResolvedResponse(res);
  await cancelBody(res);
  return result;
}

/**
 * Runs checkUrlRoutingStatus with retries for network-level failures only (timeout, DNS
 * failure, connection refused/reset, TLS error - anything the fetch itself throws for, not
 * distinguished by cause). A response that resolves normally (even to an 'unknown' outcome,
 * e.g. a 404 or an ambiguous redirect) is never retried - only a thrown exception is.
 * After all attempts are exhausted, a persistently unreachable URL is treated as a confirmed
 * failure ('fail'), not merely inconclusive.
 */
async function checkWithRetries(url, log) {
  const totalAttempts = RETRY_DELAYS_MS.length + 1;
  let lastError;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await checkUrlRoutingStatus(url);
    } catch (error) {
      lastError = error;
      log.warn(`[routing-validator] attempt ${attempt}/${totalAttempts} failed for ${url}`, { error: error.message });
      if (attempt < totalAttempts) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]);
        });
      }
    }
  }
  return {
    outcome: 'fail',
    metadata: { reason: 'network_error', lastError: lastError.message, attempts: totalAttempts },
  };
}

export default class RoutingValidator extends BaseValidator {
  // eslint-disable-next-line class-methods-use-this
  getType() {
    return ROUTING_VALIDATOR_TYPE;
  }

  // eslint-disable-next-line no-unused-vars
  async validate(suggestion, context) {
    const url = suggestion.getData()?.url;
    if (!url) {
      return { outcome: 'unknown', metadata: { reason: 'missing_url' } };
    }
    if (!isAllowedUrl(url)) {
      return { outcome: 'unknown', metadata: { reason: 'disallowed_url' } };
    }
    return checkWithRetries(url, this.log);
  }
}
