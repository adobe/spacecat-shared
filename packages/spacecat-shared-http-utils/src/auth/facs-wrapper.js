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
import { resolveRouteCapability } from './route-utils.js';

// Permanent bypass: Adobe internal IMS org IDs are never subject to FACS enforcement.
// Sourced from env var FACS_EXCEPTION_INTERNAL_ORGS (comma-separated). Keep in sync
// with ADMIN_GROUP_IDENT_BY_PRODUCT in spacecat-auth-service/src/ims/login.js.
function parseFacsExceptionInternalOrgs(env) {
  const raw = env?.FACS_EXCEPTION_INTERNAL_ORGS;
  if (!raw) {
    return new Set();
  }
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

/**
 * Pulls a stable user identifier out of the auth profile for log lines.
 *
 * Both auth paths SpaceCat uses set one of these two fields:
 *   - JWT (JwtHandler, session token):  `sub` (= userId, e.g. `ABC123@<orgId>`),
 *                                        `email` (= userId in current login.js).
 *   - IMS (AdobeImsHandler):            `email` (= user_id, set by transformProfile).
 *
 * `sub` is preferred when present (standard JWT semantics); `email` is the
 * always-available fallback across both paths.
 */
function resolveUserIdent(authInfo) {
  const profile = authInfo?.getProfile?.() || {};
  return profile.sub || profile.email || undefined;
}

function forbidden(message) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

/**
 * FACS authorization wrapper for the helix-shared-wrap `.with()` chain.
 *
 * Enforces FACS permissions for external customer users on a route-by-route basis,
 * gated by per-product LaunchDarkly feature flags. Internal identities
 * (admin / S2S / read-only admin) and Adobe internal IMS orgs always bypass.
 *
 * ## Expected `routeFacsCapabilities` shape
 *
 * ```
 * {
 *   INTERNAL_ROUTES: ['METHOD /path', ...],   // accepted, ignored by the wrapper
 *   PRODUCTS_ROUTES: {
 *     LLMO: { 'METHOD /path': 'llmo/can_*', ... },   // values are FULL permissions
 *     ASO:  { ... },
 *     ACO:  { ... },
 *   }
 * }
 * ```
 *
 * - `PRODUCTS_ROUTES[<PRODUCT>]` holds the customer-facing route → permission
 *   map for that product. Values are fully-qualified permission strings
 *   (e.g. `'llmo/can_view'`); the wrapper does NOT compose `<product>/<action>`
 *   at runtime — each product authors its own role/permission vocabulary.
 * - `INTERNAL_ROUTES` is informational only (callers use it to assert a
 *   coverage invariant: `routes(product) ∪ INTERNAL_ROUTES = all_routes`).
 *   The wrapper does not act on it: internal endpoints are already covered by
 *   the identity bypass (admin / S2S / read-only admin / Adobe internal org)
 *   for callers permitted to reach them, and by deny-by-default below for
 *   external customers (any route absent from the product map → 403).
 *
 * ## Bypass rules (in order)
 *
 * 0. CORS preflight (`OPTIONS`) requests bypass. The browser sends them
 *    without credentials but, in this deployment, Fastly forwards
 *    `x-product` on the preflight — so the "no x-product" bypass below
 *    cannot be relied on to short-circuit them. Without this rule, every
 *    preflight reaches deny-by-default and the browser blocks the real
 *    follow-up request.
 * 1. Internal identities (`is_admin`, `is_s2s_admin`, `is_s2s_consumer`,
 *    `is_read_only_admin`) bypass.
 * 2. Adobe internal IMS orgs (`FACS_EXCEPTION_INTERNAL_ORGS`) bypass.
 * 3. Requests without `x-product` header bypass (treated as not enrolled).
 * 4. Products with no sub-map (or empty sub-map) bypass.
 * 5. Per-product LaunchDarkly flag missing or disabled → bypass.
 *
 * Otherwise: route lookup in the product map. Missing route → 403 (deny by
 * default; this is what gates external customers off admin/S2S/infrastructure
 * routes). Caller missing the required FACS permission → 403.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeFacsCapabilities: {
 *   INTERNAL_ROUTES?: string[],
 *   PRODUCTS_ROUTES: Object<string, Object<string, string>>,
 * }}} opts - Required FACS capabilities config.
 * @returns {Function} A wrapped handler.
 */
export function facsWrapper(fn, { routeFacsCapabilities } = {}) {
  if (!routeFacsCapabilities || typeof routeFacsCapabilities !== 'object') {
    throw new Error('facsWrapper: routeFacsCapabilities is required');
  }
  if (!routeFacsCapabilities.PRODUCTS_ROUTES
      || typeof routeFacsCapabilities.PRODUCTS_ROUTES !== 'object') {
    throw new Error('facsWrapper: routeFacsCapabilities.PRODUCTS_ROUTES is required');
  }

  const productsRoutes = routeFacsCapabilities.PRODUCTS_ROUTES;

  return async (request, context) => {
    const { log } = context;

    // (0) CORS preflight — Fastly forwards `x-product` on OPTIONS in this
    // deployment, so the "no x-product" bypass below would NOT catch it.
    // Preflight has no credentials and no business intent; bypass early.
    if (context.pathInfo?.method === 'OPTIONS') {
      return fn(request, context);
    }

    const authInfo = context.attributes?.authInfo;

    // (1) Internal identities — FACS applies to external customer users only.
    if (
      authInfo?.isAdmin?.()
      || authInfo?.isS2SAdmin?.()
      || authInfo?.isS2SConsumer?.()
      || authInfo?.isReadOnlyAdmin?.()
    ) {
      return fn(request, context);
    }

    // (2) Adobe internal IMS org IDs — permanent bypass (env-configured).
    const orgId = authInfo?.getTenantIds?.()?.[0];
    const internalImsOrgIds = parseFacsExceptionInternalOrgs(context.env);
    if (orgId && internalImsOrgIds.has(orgId)) {
      log.debug({ tag: 'facs', org: orgId }, 'Internal Adobe org — bypassing FACS');
      return fn(request, context);
    }

    // (3) No x-product header → not enrolled in FACS → bypass.
    const productCode = context.pathInfo?.headers?.[X_PRODUCT_HEADER]?.toLowerCase();
    if (!productCode) {
      return fn(request, context);
    }

    // (4) Product not enrolled (no sub-map or empty sub-map) → bypass.
    const productMap = productsRoutes[productCode.toUpperCase()];
    if (!productMap || Object.keys(productMap).length === 0) {
      log.debug({ tag: 'facs', product: productCode }, 'Product not enrolled in FACS — bypassing');
      return fn(request, context);
    }

    // (5) Per-product LaunchDarkly flag gate. If no flag is wired for this
    // product, or the flag is off for this org, bypass.
    const flagKey = FF_MAC_FACS_PERMISSIONS[productCode.toUpperCase()];
    if (!flagKey) {
      log.debug({ tag: 'facs', product: productCode }, 'No FACS flag configured for product — bypassing');
      return fn(request, context);
    }
    if (orgId) {
      // `LaunchDarklyClient.createFrom` throws when the LD SDK key is not
      // configured (typical for IT environments and test harnesses). Treat
      // any failure to construct the client as "flag unavailable" → bypass
      // (fail-open). The flag is a controlled-rollout switch, not a security
      // gate; the security gate is the FACS permission check below.
      let ldClient = null;
      try {
        ldClient = LaunchDarklyClient.createFrom(context);
      } catch (e) {
        log.debug({ tag: 'facs', err: e.message }, 'LaunchDarkly client unavailable — bypassing FACS flag check');
      }
      const isFacsEnabled = ldClient
        ? await ldClient.isFlagEnabledForIMSOrg(flagKey, `${orgId}@AdobeOrg`).catch(() => false)
        : false;
      if (!isFacsEnabled) {
        log.debug({
          tag: 'facs',
          org: orgId,
          product: productCode,
        }, 'FACS flag disabled — bypassing');
        return fn(request, context);
      }
    }

    // Deny by default: unmapped routes within an enrolled product return 403.
    // `productMap` values are already full permission strings (e.g. `'llmo/can_view'`);
    // no runtime composition.
    const requiredPermission = resolveRouteCapability(context, productMap);
    if (!requiredPermission) {
      log.warn({
        tag: 'facs',
        method: context.pathInfo?.method,
        suffix: context.pathInfo?.suffix,
        user: resolveUserIdent(authInfo),
      }, 'Route not in PRODUCTS_ROUTES — denying FACS user');
      return forbidden('Forbidden');
    }

    if (!authInfo?.hasFacsPermission?.(requiredPermission)) {
      log.warn({
        tag: 'facs',
        permission: requiredPermission,
        user: resolveUserIdent(authInfo),
      }, 'FACS permission denied');
      return forbidden('Forbidden');
    }

    return fn(request, context);
  };
}
