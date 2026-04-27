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

export const EDGE_OPTIMIZE_PROXY_BASE_URL_DEFAULT = 'https://live.edgeoptimize.net';

// Blocks loopback, link-local, and RFC1918 ranges — never forward these as probe targets.
export const PRIVATE_HOST_RE = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i;

export const WAF_PROBE_TIMEOUT_MS = 15000;

// Soft-block detection: vendor-specific technical identifiers that only appear in
// WAF-generated challenge pages, never in real page content. Broad natural-language
// terms ('challenge', 'captcha', 'access denied') are intentionally excluded — they
// match legitimate marketing copy and reCAPTCHA script tags, producing false positives
// at any body scan depth.
export const BOT_CHALLENGE_KEYWORDS = [
  'cf-chl-widget', // Cloudflare challenge widget CSS class
  'completing the challenge', // Cloudflare-specific challenge phrase
  '_incapsula_resource', // Imperva/Incapsula JS artifact — only in WAF-generated pages
  'errors.edgesuite.net', // Akamai error page domain
  'errors.edgekey.net', // Akamai edge key domain
];

// 403 and 429 are universal WAF block signals; 406 is Fastly Next-Gen WAF (Signal Sciences)
// and some Imperva configurations. 401 covers WAF-gated auth challenges. 503 is used by
// Akamai and others as a block response in certain configurations.
export const HARD_BLOCK_STATUS_CODES = new Set([401, 403, 406, 429, 503]);

/**
 * Classifies an already-fetched Tokowaka-proxied response into one of four probe outcomes:
 *   - Hard block  : HTTP status in HARD_BLOCK_STATUS_CODES → { reachable: false, blocked: true }
 *   - CF challenge: cf-mitigated: challenge header         → { reachable: false, blocked: true }
 *   - Soft block  : 2xx HTML body with vendor keywords     → { reachable: false, blocked: true }
 *   - Clean pass  : 2xx with real content                  → { reachable: true,  blocked: false }
 *   - Other       : unexpected status (e.g. redirect)      → { reachable: false, blocked: false }
 *
 * @param {Response} response - Fetch response from the Tokowaka proxy.
 * @param {string} targetHost - Customer hostname, used only for log messages.
 * @param {Object} log - Logger with an `info` method.
 * @returns {Promise<Object>} Classification result.
 */
export async function classifyProbeResponse(response, targetHost, log) {
  const { status } = response;

  if (HARD_BLOCK_STATUS_CODES.has(status)) {
    log.info(`[edge-optimize-probe] Hard block for ${targetHost}: HTTP ${status}`);
    return { reachable: false, blocked: true, statusCode: status };
  }

  // Cloudflare active challenge: present on any response where CF is serving a managed
  // challenge — definitive block signal regardless of HTTP status code.
  if (response.headers.get('cf-mitigated') === 'challenge') {
    log.info(`[edge-optimize-probe] Cloudflare challenge for ${targetHost} (cf-mitigated: challenge)`);
    return { reachable: false, blocked: true, statusCode: status };
  }

  if (status >= 200 && status < 300) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const text = await response.text();
      const isSoftBlock = BOT_CHALLENGE_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
      if (isSoftBlock) {
        log.info(`[edge-optimize-probe] Soft block (challenge page) for ${targetHost}: HTTP ${status}`);
        return { reachable: false, blocked: true, statusCode: status };
      }
    }
    log.info(`[edge-optimize-probe] Clean pass for ${targetHost}: HTTP ${status}`);
    return { reachable: true, blocked: false, statusCode: status };
  }

  log.info(`[edge-optimize-probe] Unexpected status for ${targetHost}: HTTP ${status}`);
  return { reachable: false, blocked: false, statusCode: status };
}
