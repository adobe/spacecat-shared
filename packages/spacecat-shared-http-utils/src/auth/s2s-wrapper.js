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

import { Response } from '@adobe/fetch';
import { hasText, isNonEmptyArray, isObject } from '@adobe/spacecat-shared-utils';

import { getBearerToken } from './handlers/utils/bearer.js';
import { loadPublicKey, validateToken } from './handlers/utils/token.js';

/**
 * Matches pre-split request segments against a route pattern with :param segments.
 * e.g. ['sites', 'abc-123', 'audits'] matches 'GET /sites/:siteId/audits'
 */
function matchRoute(method, requestSegments, routeKey) {
  const spaceIdx = routeKey.indexOf(' ');
  if (spaceIdx === -1) return false;

  const routeMethod = routeKey.slice(0, spaceIdx);
  if (routeMethod !== method) return false;

  const routeSegments = routeKey.slice(spaceIdx + 1).split('/').filter(Boolean);
  if (routeSegments.length !== requestSegments.length) return false;

  return routeSegments.every(
    (seg, i) => seg.charCodeAt(0) === 58 /* ':' */ || seg === requestSegments[i],
  );
}

/**
 * Looks up the required capability for the current request from the
 * routeCapabilities map using the method and path from context.pathInfo.
 */
function resolveCapability(context, routeCapabilities) {
  const method = context.pathInfo?.method?.toUpperCase();
  const path = context.pathInfo?.suffix;
  if (!method || !path) return null;

  const exactKey = `${method} ${path}`;
  if (routeCapabilities[exactKey]) return routeCapabilities[exactKey];

  const requestSegments = path.split('/').filter(Boolean);
  const matchedKey = Object.keys(routeCapabilities)
    .find((key) => matchRoute(method, requestSegments, key));
  return matchedKey ? routeCapabilities[matchedKey] : null;
}

/**
 * S2S consumer auth wrapper for the helix-shared-wrap `.with()` chain.
 * Validates a JWT bearer token and, when the token carries the
 * {@code is_s2s_consumer} claim, resolves the required capability for the
 * current route from the provided {@code routeCapabilities} map and verifies
 * the caller holds that capability in {@code tenants[].capabilities}.
 *
 * Non-S2S tokens (end-user) pass through untouched.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeCapabilities: Object<string, string> }} opts - Map of route
 *   patterns (e.g. 'GET /sites/:siteId') to capability strings (e.g. 'site:read').
 * @returns {Function} A wrapped handler.
 */
export function s2sAuthWrapper(fn, { routeCapabilities } = {}) {
  let publicKey;

  return async (request, context) => {
    const { log } = context;

    try {
      if (!publicKey) {
        publicKey = await loadPublicKey(context);
      }

      const token = getBearerToken(context);
      if (!hasText(token)) {
        log.debug('[s2s] No bearer token provided');
        return new Response('Unauthorized', { status: 401 });
      }

      const payload = await validateToken(token, publicKey);

      if (!payload.is_s2s_consumer) {
        log.debug('[s2s] Token is not an S2S consumer token, passing through');
        context.s2sCtx = {};
        return fn(request, context);
      }

      const tenants = payload.tenants || [];
      const capabilities = tenants.flatMap((tenant) => tenant.capabilities || []);

      if (!isNonEmptyArray(capabilities)) {
        log.debug('[s2s] S2S consumer token has no capabilities');
        return new Response('Forbidden', { status: 403 });
      }

      if (isObject(routeCapabilities)) {
        const requiredCapability = resolveCapability(context, routeCapabilities);
        if (!hasText(requiredCapability)) {
          log.error(`[s2s] Route ${context.pathInfo?.method} ${context.pathInfo?.suffix} is not allowed for S2S consumers`);
          return new Response('Unauthorized', { status: 401 });
        }
        if (!capabilities.includes(requiredCapability)) {
          log.error(`[s2s] Token is missing required capability: ${requiredCapability}`);
          return new Response('Forbidden', { status: 403 });
        }
      }

      context.s2sCtx = {
        clientId: payload.client_id,
        scopedOrgId: tenants[0]?.id,
      };
    } catch (e) {
      log.error(`[s2s] Authentication failed: ${e.message}`);
      return new Response('Unauthorized', { status: 401 });
    }

    return fn(request, context);
  };
}
