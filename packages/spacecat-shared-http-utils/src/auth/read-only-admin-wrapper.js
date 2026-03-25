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
import { isObject } from '@adobe/spacecat-shared-utils';
import { LaunchDarklyClient } from '@adobe/spacecat-shared-launchdarkly-client';

import { FF_READ_ONLY_ADMIN } from './constants.js';
import { guardNonEmptyRouteCapabilities, resolveRouteCapability } from './route-utils.js';

function forbidden(message) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

/**
 * Evaluates the read-only admin feature flag for the authenticated user's IMS org.
 * Uses {@link AuthInfo#getTenantIds} to resolve the org and
 * {@link LaunchDarklyClient#isFlagEnabledForIMSOrg} for evaluation.
 * Fail-closed: returns false when the client/org is unavailable or evaluation errors.
 *
 * @param {Object} context - Universal context (lambda context)
 * @param {Object} authInfo - The AuthInfo instance for the current user
 * @returns {Promise<boolean>}
 */
async function evaluateFeatureFlag(context, authInfo) {
  try {
    const ldClient = LaunchDarklyClient.createFrom(context);
    if (!ldClient) return false;

    const tenantIds = authInfo.getTenantIds?.() || [];
    const ident = tenantIds[0];
    if (!ident) return false;

    const imsOrgId = `${ident}@AdobeOrg`;
    return await ldClient.isFlagEnabledForIMSOrg(FF_READ_ONLY_ADMIN, imsOrgId);
  } catch {
    return false;
  }
}

/**
 * Read-only admin authorization wrapper for the helix-shared-wrap `.with()` chain.
 *
 * After successful authentication (authInfo already set on context by an earlier
 * wrapper), this wrapper checks whether the authenticated user is a read-only admin.
 * If so it:
 *
 * 1. Evaluates the `FT_LLMO-3008` LaunchDarkly feature flag (fail-closed).
 * 2. Resolves the route's action from the routeCapabilities map and blocks
 *    write operations (or unmapped routes) for RO admins.
 * 3. Emits a structured audit log entry for allowed RO admin requests.
 *
 * Non-RO-admin requests pass through untouched.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeCapabilities?: Object<string, string> }} opts - Map of route
 *   patterns (e.g. 'GET /sites/:siteId') to action strings ('read' | 'write').
 * @returns {Function} A wrapped handler.
 */
export function readOnlyAdminWrapper(fn, { routeCapabilities } = {}) {
  guardNonEmptyRouteCapabilities('readOnlyAdminWrapper', routeCapabilities);

  return async (request, context) => {
    const { log } = context;
    const authInfo = context.attributes?.authInfo;

    if (authInfo?.isReadOnlyAdmin?.()) {
      const ffEnabled = await evaluateFeatureFlag(context, authInfo);
      if (!ffEnabled) {
        log.warn('[ro-admin] Feature flag disabled, denying RO admin access');
        return forbidden('Read-only admin access is not enabled');
      }

      if (isObject(routeCapabilities)) {
        const capability = resolveRouteCapability(context, routeCapabilities);
        const action = capability?.split(':').pop();

        if (action !== 'read') {
          const route = `${context.pathInfo?.method} ${context.pathInfo?.suffix}`;
          log.warn(`[ro-admin] Read-only admin blocked from route: ${route}`);
          return forbidden('Read-only admin users cannot perform write operations');
        }
      }

      log.info(`[ro-admin-audit] RO admin accessed: ${context.pathInfo?.method} ${context.pathInfo?.suffix}`);
    }

    return fn(request, context);
  };
}
