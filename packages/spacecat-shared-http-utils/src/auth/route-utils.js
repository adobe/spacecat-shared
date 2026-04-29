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
 * @param {Object} context - Universal context with pathInfo
 * @param {Object<string, string>} routeMap - Route pattern to value map
 * @returns {string|null} The matched value or null
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
 * Throws at wrapper creation time if routeCapabilities is an empty object.
 * An empty map would silently deny/block all requests, so this is a
 * fail-fast guard against misconfiguration.
 *
 * @param {string} wrapperName - Name of the wrapper (for the error message)
 * @param {Object} routeCapabilities - The route capabilities map
 */
export function guardNonEmptyRouteCapabilities(wrapperName, routeCapabilities) {
  if (isObject(routeCapabilities) && Object.keys(routeCapabilities).length === 0) {
    throw new Error(`${wrapperName}: routeCapabilities must not be an empty object`);
  }
}
