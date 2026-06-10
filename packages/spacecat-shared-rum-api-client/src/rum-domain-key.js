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

import RUMAPIClient from './client.js';

const RUM_CHECK_TIMEOUT_MS = 3000;

/**
 * Resolves whether a site has a RUM domain key by trying candidates in priority order:
 *   1. overrideBaseURL hostname (from fetchConfig, when set)
 *   2. www.{overrideHostname}
 *   3. baseURL hostname
 *   4. www.{baseHostname}
 *
 * Stops on the first successful lookup. The 3 s timeout is a shared budget across
 * the full candidate loop, not a per-domain limit.
 *
 * @param {object} site - Site model instance (getBaseURL, getConfig, getId).
 * @param {object} context - Request/worker context (env, log).
 * @returns {Promise<{hasDomainKey: boolean, timedOut: boolean}>}
 */
export async function resolveRumDomainKey(site, context) {
  const { log } = context;
  const siteId = site.getId();

  const siteConfig = site.getConfig();
  const overrideBaseURL = siteConfig.getFetchConfig()?.overrideBaseURL;

  let overrideHostname = null;
  if (overrideBaseURL) {
    try {
      overrideHostname = new URL(overrideBaseURL).hostname;
    } catch {
      log.warn(`[rum-domain-key] Malformed overrideBaseURL for site ${siteId}: ${overrideBaseURL}, falling back to baseURL`);
    }
  }

  let baseHostname;
  try {
    baseHostname = new URL(site.getBaseURL()).hostname;
  } catch {
    log.error(`[rum-domain-key] Malformed baseURL for site ${siteId}: ${site.getBaseURL()}, skipping`);
    return { hasDomainKey: false, timedOut: false };
  }

  const withWww = (d) => (d && !d.startsWith('www.') ? `www.${d}` : null);

  const domains = [...new Set([
    overrideHostname,
    withWww(overrideHostname),
    baseHostname,
    withWww(baseHostname),
  ].filter(Boolean))];

  let hasDomainKey = false;
  let timeoutId;
  let timedOut = false;
  let cancelled = false;

  const rumApiClient = RUMAPIClient.createFrom(context);

  try {
    await Promise.race([
      (async () => {
        for (const domain of domains) {
          if (cancelled) {
            break;
          }
          try {
            // eslint-disable-next-line no-await-in-loop
            await rumApiClient.retrieveDomainkey(domain);
            hasDomainKey = true;
            return;
          } catch (e) {
            log.info(`[rum-domain-key] RUM check failed for ${domain}: ${e.message}`);
          }
        }
        if (!hasDomainKey) {
          log.warn(`[rum-domain-key] No domain key found for site ${siteId} across all candidates: ${domains.join(', ')}`);
        }
      })(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          cancelled = true;
          reject(new Error('RUM check timed out'));
        }, RUM_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (timedOut) {
      log.error(`[rum-domain-key] RUM check timed out for site ${siteId} across: ${domains.join(', ')}`);
    /* c8 ignore next 3 */
    } else {
      log.warn(`[rum-domain-key] Unexpected error during RUM check for site ${siteId}: ${e.message}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return { hasDomainKey, timedOut };
}
