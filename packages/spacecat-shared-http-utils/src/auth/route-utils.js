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

import { isObject } from '@adobe/spacecat-shared-utils';

/**
 * Matches pre-split request segments against a route pattern with :param segments.
 * e.g. ['sites', 'abc-123', 'audits'] matches 'GET /sites/:siteId/audits'
 */
function matchRoute(method, requestSegments, routeKey) {
  const spaceIdx = routeKey.indexOf(' ');
  if (spaceIdx === -1) {
    return false;
  }

  const routeMethod = routeKey.slice(0, spaceIdx);
  if (routeMethod !== method) {
    return false;
  }

  const routeSegments = routeKey.slice(spaceIdx + 1).split('/').filter(Boolean);
  if (routeSegments.length !== requestSegments.length) {
    return false;
  }

  return routeSegments.every(
    (seg, i) => seg.charCodeAt(0) === 58 /* ':' */ || seg === requestSegments[i],
  );
}

/**
 * Looks up the value mapped to the current request from a route map
 * using the method and path from context.pathInfo. Supports both exact
 * matches and parameterized route patterns (e.g. 'GET /sites/:siteId').
 *
 * The mapped value is returned verbatim — it may be a single capability string
 * or an array of acceptable capabilities. Callers must handle both shapes (the
 * s2sAuthWrapper normalizes to an array). Note an empty array `[]` is truthy and
 * is passed through; the wrapper treats it as "no usable capability" and denies.
 *
 * @param {Object} context - Universal context with pathInfo
 * @param {Object<string, string|string[]>} routeMap - Route pattern to value map
 * @returns {string|string[]|null} The matched value or null
 */
export function resolveRouteCapability(context, routeMap) {
  const method = context.pathInfo?.method?.toUpperCase();
  const path = context.pathInfo?.suffix;
  if (!method || !path) {
    return null;
  }

  const exactKey = `${method} ${path}`;
  if (routeMap[exactKey]) {
    return routeMap[exactKey];
  }

  const requestSegments = path.split('/').filter(Boolean);
  const matchedKey = Object.keys(routeMap)
    .find((key) => matchRoute(method, requestSegments, key));
  return matchedKey ? routeMap[matchedKey] : null;
}

/**
 * Extracts named path parameters from the route pattern that matches the current request.
 * e.g. route 'PATCH /sites/:siteId', suffix '/sites/abc-123' → { siteId: 'abc-123' }
 * Returns an empty object when there is no match or the match has no parameters.
 *
 * When routeMap has no entry for the request's method+path, falls back to fallbackRoutes
 * (the full internal route list) so ownership checks can still resolve path params for
 * routes that are known to the service but not mapped in routeCapabilities.
 *
 * @param {Object} context - Universal context with pathInfo
 * @param {Object<string, string>} routeMap - Route pattern to value map
 * @param {string[]} [fallbackRoutes=[]] - Additional route patterns to try when routeMap has
 *   no match (e.g. 'DELETE /sites/:siteId')
 * @returns {Object<string, string>}
 */
export function extractRouteParams(context, routeMap, fallbackRoutes = []) {
  const method = context.pathInfo?.method?.toUpperCase();
  const path = context.pathInfo?.suffix;
  if (!method || !path) {
    return {};
  }

  const requestSegments = path.split('/').filter(Boolean);
  const matchedKey = Object.keys(routeMap).find((key) => matchRoute(method, requestSegments, key))
    || fallbackRoutes.find((route) => matchRoute(method, requestSegments, route));
  if (!matchedKey) {
    return {};
  }

  const routeSegments = matchedKey.slice(matchedKey.indexOf(' ') + 1).split('/').filter(Boolean);
  const params = {};
  routeSegments.forEach((seg, i) => {
    if (seg.charCodeAt(0) === 58 /* ':' */) {
      params[seg.slice(1)] = requestSegments[i];
    }
  });
  return params;
}

/**
 * Returns the matched route pattern key (e.g. `'GET /sites/:siteId/llmo/config'`)
 * for the current request, looked up in the supplied route map. Returns null when
 * no entry matches. Mirrors the matching logic of `resolveRouteCapability` and
 * `extractRouteParams`, but returns the pattern itself so callers can do further
 * structural work on it (param ordering, etc.).
 *
 * @param {Object} context - Universal context with pathInfo
 * @param {Object<string, *>} routeMap - Route pattern to value map (only the keys are used)
 * @returns {string|null}
 */
export function findMatchedRouteKey(context, routeMap) {
  const method = context.pathInfo?.method?.toUpperCase();
  const path = context.pathInfo?.suffix;
  if (!method || !path) {
    return null;
  }
  const exactKey = `${method} ${path}`;
  if (Object.prototype.hasOwnProperty.call(routeMap, exactKey)) {
    return exactKey;
  }
  const requestSegments = path.split('/').filter(Boolean);
  return Object.keys(routeMap)
    .find((key) => matchRoute(method, requestSegments, key)) || null;
}

/**
 * Parses a route pattern (e.g. `'GET /sites/:siteId/llmo/config'`) into the
 * ordered list of `:param` names declared by it. Order is **declaration order
 * left-to-right**, which is what Phase 2 of the FACS wrapper needs to do a
 * LIFO (rightmost-first) scan of resource params.
 *
 * @param {string} routePattern - Route pattern starting with 'METHOD /path'.
 * @returns {string[]} param names in declaration order, e.g. ['siteId'].
 */
export function extractParamNamesInOrder(routePattern) {
  if (typeof routePattern !== 'string') {
    return [];
  }
  const spaceIdx = routePattern.indexOf(' ');
  if (spaceIdx === -1) {
    return [];
  }
  return routePattern
    .slice(spaceIdx + 1)
    .split('/')
    .filter((seg) => seg.length > 0 && seg.charCodeAt(0) === 58 /* ':' */)
    .map((seg) => seg.slice(1));
}

/**
 * Throws at wrapper creation time if routeCapabilities is not a non-empty plain object.
 * Rejects undefined, null, arrays, strings, numbers, and empty objects so a caller
 * cannot accidentally pass a shape the wrapper's `if (isObject(...))` check would skip,
 * which would silently disable the auth block.
 *
 * @param {string} wrapperName - Name of the wrapper (for the error message)
 * @param {Object} routeCapabilities - The route capabilities map
 */
export function guardNonEmptyRouteCapabilities(wrapperName, routeCapabilities) {
  if (!isObject(routeCapabilities) || Object.keys(routeCapabilities).length === 0) {
    throw new Error(`${wrapperName}: routeCapabilities must be a non-empty object`);
  }
}
