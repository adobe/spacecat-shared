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

import { Response } from '@adobe/fetch';
import { LaunchDarklyClient } from '@adobe/spacecat-shared-launchdarkly-client';

import { FF_MAC_FACS_PERMISSIONS, X_PRODUCT_HEADER } from './constants.js';
import { guardNonEmptyRouteCapabilities, resolveRouteCapability } from './route-utils.js';

// Permanent bypass: Adobe internal IMS org IDs are never subject to FACS enforcement.
// Keep in sync with ADMIN_GROUP_IDENT_BY_PRODUCT in spacecat-auth-service/src/ims/login.js.
const INTERNAL_IMS_ORG_IDS = new Set([
  '8C6043F15F43B6390A49401A', // Adobe internal — stag
  '908936ED5D35CC220A495CD4', // Adobe internal — prod
]);

function forbidden(message) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

function badRequest(message) {
  return new Response(JSON.stringify({ message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

/**
 * FACS authorization wrapper for the helix-shared-wrap `.with()` chain.
 *
 * Enforces FACS permissions for external customer users, gated by the
 * FT_MAC_FACS_PERMISSIONS LaunchDarkly feature flag per org. Internal
 * identities (admin, S2S, read-only admin) and Adobe internal IMS orgs
 * always bypass. Fail-closed: unmapped routes and missing permissions
 * return 403; missing x-product header returns 400.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeFacsCapabilities: Object<string, string> }} opts - Required map of route
 *   patterns to FACS action strings (e.g. 'GET /insights' → 'can_read').
 * @returns {Function} A wrapped handler.
 */
export function facsWrapper(fn, { routeFacsCapabilities } = {}) {
  if (!routeFacsCapabilities) {
    throw new Error('facsWrapper: routeFacsCapabilities is required');
  }
  guardNonEmptyRouteCapabilities('facsWrapper', routeFacsCapabilities);

  return async (request, context) => {
    const { log } = context;
    const authInfo = context.attributes?.authInfo;

    if (!authInfo?.isAuthenticated()) {
      return fn(request, context);
    }

    // Bypass for internal identities — FACS applies to external customer users only.
    if (
      authInfo.isAdmin()
      || authInfo.isS2SAdmin()
      || authInfo.isS2SConsumer()
      || authInfo.isReadOnlyAdmin()
    ) {
      return fn(request, context);
    }

    // Permanent bypass for Adobe internal IMS org IDs.
    const orgId = authInfo.getTenantIds?.()?.[0];
    if (orgId && INTERNAL_IMS_ORG_IDS.has(orgId)) {
      log.debug({ tag: 'facs', org: orgId }, 'Internal Adobe org — bypassing FACS');
      return fn(request, context);
    }

    // Feature flag gate — controlled rollout per customer org.
    if (orgId) {
      const ldClient = LaunchDarklyClient.createFrom(context);
      const isFacsEnabled = ldClient
        ? await ldClient.isFlagEnabledForIMSOrg(FF_MAC_FACS_PERMISSIONS, `${orgId}@AdobeOrg`).catch(() => false)
        : false;

      if (!isFacsEnabled) {
        log.debug({ tag: 'facs', org: orgId }, 'FT_MAC_FACS_PERMISSIONS disabled — bypassing');
        return fn(request, context);
      }
    }

    // Deny by default for unmapped routes.
    const requiredAction = resolveRouteCapability(context, routeFacsCapabilities);
    if (!requiredAction) {
      log.warn({
        tag: 'facs',
        method: context.pathInfo?.method,
        suffix: context.pathInfo?.suffix,
        user: authInfo.getProfile?.()?.sub,
      }, 'Route not in routeFacsCapabilities — denying FACS user');
      return forbidden('Forbidden');
    }

    // Compose full FACS permission from x-product header + route action.
    const productCode = context.pathInfo?.headers?.[X_PRODUCT_HEADER]?.toLowerCase();
    if (!productCode) {
      log.warn({ tag: 'facs', requiredAction }, 'Missing x-product header for FACS-gated route');
      return badRequest('x-product header is required');
    }
    const requiredPermission = `${productCode}/${requiredAction}`;

    if (!authInfo.hasFacsPermission(requiredPermission)) {
      log.warn({
        tag: 'facs',
        permission: requiredPermission,
        user: authInfo.getProfile?.()?.sub,
      }, 'FACS permission denied');
      return forbidden('Forbidden');
    }

    return fn(request, context);
  };
}
