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

import { FT_MAC_FACS_PERMISSIONS, X_PRODUCT_HEADER } from './constants.js';
import { findMatchedRouteKey, resolveRouteCapability } from './route-utils.js';
import { buildAliasLookupsPerProduct, resolveFacsResource } from './facs-resource-resolver.js';
import { findFacsResourceBinding } from './facs-state-layer.js';

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
 * Pulls the canonical subject identifier out of the JWT profile.
 *
 * `spacecat-auth-service/src/ims/login.js` canonicalizes `profile.userId`,
 * `profile.sub`, and `profile.email` to the same `<ident>@<authSrc>` value
 * before signing the JWT (see Identifiers and flags table in
 * mac-state-layer.md). They are byte-equal by construction, so this helper
 * picks `sub` — set on JWT session tokens and on IMS-bearer-token paths.
 */
function resolveUserIdent(authInfo) {
  return authInfo?.getProfile?.()?.sub;
}

function forbidden(message) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

function serviceUnavailable(message) {
  return new Response(JSON.stringify({ message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

function internalServerError(message) {
  return new Response(JSON.stringify({ message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

/**
 * Checks whether the request matches a route in ANY product's sub-map.
 * Used to distinguish "FACS-governed route called without the right
 * x-product header" (deny) from "non-FACS route" (bypass).
 *
 * Per-request cost is bounded by the number of products (typically <5);
 * each call to resolveRouteCapability is an O(routes-in-product) hash check.
 */
function routeMatchesAnyProductMap(context, productsRoutes) {
  for (const productMap of Object.values(productsRoutes)) {
    if (productMap && Object.keys(productMap).length > 0
        && resolveRouteCapability(context, productMap) !== null) {
      return true;
    }
  }
  return false;
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
 * ## Bypass rules (fail-closed)
 *
 * 0. CORS preflight (`OPTIONS`) → bypass.
 * 1. Internal identities (`is_admin`, `is_s2s_admin`, `is_s2s_consumer`,
 *    `is_read_only_admin`, and api-key auth types `legacyApiKey` /
 *    `scopedApiKey`) → bypass.
 * 2. Adobe internal IMS orgs (`FACS_EXCEPTION_INTERNAL_ORGS`) → bypass.
 * 3. Route NOT in any product map → bypass (not FACS-governed, e.g.
 *    `/heartbeat`, S2S-only paths).
 *    Route IS in some product map but `x-product` is missing or names a
 *    product whose sub-map doesn't list it → **403** (fail-closed; can't
 *    pick the right policy without the header).
 * 4. Per-product LaunchDarkly flag gate:
 *    - flag entry present + returns true  → proceed to enforcement
 *    - flag entry present + returns false → bypass (rollout off for org)
 *    - flag entry absent (retirement)     → bypass the rollout gate,
 *      proceed to enforcement (universal)
 *    - LD ctor failure or eval rejection  → **503** (fail-closed)
 *
 * Otherwise: route lookup in the product map. Missing required permission
 * → 403. Per-product `PRODUCTS_FACS_ADMIN_PERMISSIONS` holder → bypass.
 * Held permission in `PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS` →
 * bypass. Otherwise, state-layer binding lookup; missing binding → 403.
 *
 * ## Phase 2 state-layer (ReBAC) check
 *
 * After the JWT claim check passes, the wrapper resolves the request's
 * ReBAC resource (via `resolveFacsResource`) and looks up `facs_access_mappings`
 * via PostgREST for a user-scoped OR org-scoped grant. Missing mapping → 403.
 * Routes without a resolvable resource (listing endpoints, queries, the
 * management endpoints themselves) skip the state-layer check entirely.
 *
 * The wrapper reads `postgrestClient` from `context.dataAccess.services` —
 * the same contract every other SpaceCat consumer of the data-access wrapper
 * uses. When the postgrest client is absent (no `dataAccess` wrapper upstream
 * in the chain), the state-layer step is skipped. Phase 2 only fires when
 * `PRODUCTS_FACS_RESOURCE_PARAM_ALIASES` declares a ReBAC scope for the
 * request's product AND postgrestClient is available.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeFacsCapabilities: {
 *   INTERNAL_ROUTES?: string[],
 *   PRODUCTS_ROUTES: Object<string, Object<string, string[]>>,
 *   PRODUCTS_FACS_RESOURCE_PARAM_ALIASES?: Object<string, Object<string, string[]>>,
 *   PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS?: Object<string, string[]>,
 * }}} opts
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

  // Validate every route value is a non-empty array of strings at construction
  // time — the wrapper never has to branch on `Array.isArray(...)` per request,
  // and a misconfigured map fails at startup rather than at the first request.
  for (const [product, routes] of Object.entries(productsRoutes)) {
    for (const [route, value] of Object.entries(routes || {})) {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(
          `facsWrapper: ${product} '${route}' must be a non-empty array of permission strings`,
        );
      }
      for (const perm of value) {
        if (typeof perm !== 'string' || !perm.includes('/')) {
          throw new Error(
            `facsWrapper: ${product} '${route}' has invalid permission ${JSON.stringify(perm)} `
            + '(expected fully-qualified \'<product>/<action>\')',
          );
        }
      }
    }
  }

  // Built once. Throws if a product declares the same alias under two
  // different resources — surfaces config typos at startup, not at request time.
  const aliasLookupsPerProduct = buildAliasLookupsPerProduct(
    routeFacsCapabilities.PRODUCTS_FACS_RESOURCE_PARAM_ALIASES,
  );

  // Per-product set of permissions that bypass the Phase 2 state-layer check.
  // Held-permission matches against this set skip the resource lookup
  // entirely (e.g. llmo/can_view_all is global by design; llmo/can_manage_user
  // gates the management endpoints and must not recurse into the state layer).
  const exemptByProduct = new Map();
  for (const [product, perms] of Object.entries(
    routeFacsCapabilities.PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS || {},
  )) {
    exemptByProduct.set(product.toUpperCase(), new Set(perms || []));
  }

  return async (request, context) => {
    const { log } = context;

    // Route identity included in every bypass/grant log so operators can grep
    // for "what did FACS do with `POST /sites/123/audits`" without correlating
    // by request id.
    const method = context.pathInfo?.method;
    const suffix = context.pathInfo?.suffix;

    // (0) CORS preflight — Fastly forwards `x-product` on OPTIONS in this
    // deployment, so the "no x-product" bypass below would NOT catch it.
    // Preflight has no credentials and no business intent; bypass early.
    if (method === 'OPTIONS') {
      log.info({
        tag: 'facs',
        bypass: 'options-preflight',
        method,
        suffix,
      }, 'FACS bypass: CORS preflight');
      return fn(request, context);
    }

    const authInfo = context.attributes?.authInfo;

    // (1) Internal identities — FACS applies to external customer users only.
    //
    // Includes API-key auth surfaces (`legacyApiKey`, `scopedApiKey`): these
    // are issued to Adobe-controlled services and operators, never to
    // customer end-users. The legacy api-key handler doesn't set
    // `is_admin: true` on its profile (it sets `user_id: 'admin'` or
    // `'legacy-user'`), so without an explicit getType() check api-key
    // requests would fall through to the FACS-governance gate and 403 on
    // FACS-mapped routes — even though they were never the target audience.
    // Matches how `is_s2s_admin` / `is_s2s_consumer` are bypassed: same
    // intent (internal trust), different transport.
    const authType = authInfo?.getType?.();
    if (
      authInfo?.isAdmin?.()
      || authInfo?.isS2SAdmin?.()
      || authInfo?.isS2SConsumer?.()
      || authInfo?.isReadOnlyAdmin?.()
      || authType === 'legacyApiKey'
      || authType === 'scopedApiKey'
    ) {
      log.info({
        tag: 'facs',
        bypass: 'internal-identity',
        method,
        suffix,
        authType,
        isAdmin: !!authInfo?.isAdmin?.(),
        isS2SAdmin: !!authInfo?.isS2SAdmin?.(),
        isS2SConsumer: !!authInfo?.isS2SConsumer?.(),
        isReadOnlyAdmin: !!authInfo?.isReadOnlyAdmin?.(),
      }, 'FACS bypass: internal identity');
      return fn(request, context);
    }

    // Tenant scoping — see Identifiers and flags table in mac-state-layer.md.
    // getTenantIds() returns an array because the underlying claim is multi-
    // valued, but the SpaceCat login flow always populates exactly one entry.
    // A length > 1 is a configuration violation that the login flow shouldn't
    // have produced; fail closed with a 500 so it surfaces in alerting rather
    // than silently picking one tenant.
    const tenantIds = authInfo?.getTenantIds?.() || [];
    if (tenantIds.length > 1) {
      log.error({
        tag: 'facs',
        tenantCount: tenantIds.length,
      }, 'authInfo.getTenantIds() returned more than one tenant — failing closed');
      return internalServerError('Multi-tenant sessions are not supported');
    }
    const orgId = tenantIds[0];

    // (2) Adobe internal IMS org IDs — permanent bypass (env-configured).
    const internalImsOrgIds = parseFacsExceptionInternalOrgs(context.env);
    if (orgId && internalImsOrgIds.has(orgId)) {
      log.info({
        tag: 'facs',
        bypass: 'internal-adobe-org',
        method,
        suffix,
        org: orgId,
      }, 'FACS bypass: Adobe internal IMS org');
      return fn(request, context);
    }

    // (3) FACS-governance gate based on x-product header + route membership.
    //
    // Three cases:
    //   (a) Route NOT in any product map and x-product missing/unknown
    //       → bypass (not FACS-governed; e.g. /heartbeat, S2S admin paths).
    //   (b) Route IS in some product map but x-product is missing or names
    //       a product whose sub-map doesn't list this route → 403
    //       (fail-closed; we can't pick the right policy without the header).
    //   (c) Route IS in the product map matching x-product → proceed to LD.
    const productCode = context.pathInfo?.headers?.[X_PRODUCT_HEADER]?.toLowerCase();
    const productMap = productCode ? productsRoutes[productCode.toUpperCase()] : undefined;
    const routeInThisProduct = productMap && Object.keys(productMap).length > 0
      && resolveRouteCapability(context, productMap) !== null;

    if (!routeInThisProduct) {
      // Either no x-product, an unknown product, or a product whose sub-map
      // doesn't list this route. Decide between (a) and (b) by checking
      // whether ANY other product's sub-map claims the route.
      if (routeMatchesAnyProductMap(context, productsRoutes)) {
        log.warn({
          tag: 'facs',
          method,
          suffix,
          xProduct: productCode || null,
        }, 'FACS-governed route called without matching x-product — denying');
        return forbidden('x-product header required for FACS-governed routes');
      }
      // Truly non-FACS route → bypass.
      log.info({
        tag: 'facs',
        bypass: 'route-not-facs-governed',
        method,
        suffix,
        product: productCode || null,
      }, 'FACS bypass: route not FACS-governed');
      return fn(request, context);
    }

    // (4) Per-product LaunchDarkly flag gate.
    //
    // Three outcomes:
    //   (a) flagKey present + LD returns true  → proceed to enforcement
    //   (b) flagKey present + LD returns false → bypass (rollout off for org)
    //   (c) flagKey absent                     → bypass the rollout gate and
    //       proceed to enforcement (flag retirement: enforcement is universal
    //       for the product — see "Flag retirement" in mac-state-layer.md)
    //
    // LD ctor failure or eval rejection is fail-closed (503) — the wrapper
    // cannot determine flag state, so cannot make a defensible decision.
    // This is the opposite of the previous "fail-open bypass" behaviour
    // which would silently downgrade enforcement on LD outages.
    const flagKey = FT_MAC_FACS_PERMISSIONS[productCode.toUpperCase()];
    if (flagKey) {
      if (!orgId) {
        log.warn({
          tag: 'facs',
          product: productCode,
        }, 'No tenant on authInfo for FACS evaluation — denying');
        return forbidden('Tenant required for FACS evaluation');
      }
      let ldClient;
      try {
        ldClient = LaunchDarklyClient.createFrom(context);
      } catch (e) {
        log.error({
          tag: 'facs', err: e.message,
        }, 'LaunchDarkly client unavailable — failing closed');
        return serviceUnavailable('FACS enforcement temporarily unavailable');
      }
      let isFacsEnabled;
      try {
        // The `@AdobeOrg` suffix is the LaunchDarkly contract; auth-service
        // derives the real suffix from org.orgRef.authSrc at login time and
        // the tenant id at this layer is the bare ident. Hardcoded for now
        // (matches existing precedent in readOnlyAdminWrapper); follow-on
        // change extends this to use the canonical suffix end-to-end.
        isFacsEnabled = await ldClient.isFlagEnabledForIMSOrg(flagKey, `${orgId}@AdobeOrg`);
      } catch (e) {
        log.error({
          tag: 'facs', flagKey, org: orgId, err: e.message,
        }, 'LD flag evaluation failed — failing closed');
        return serviceUnavailable('FACS enforcement temporarily unavailable');
      }
      if (!isFacsEnabled) {
        log.info({
          tag: 'facs',
          bypass: 'ld-flag-off',
          method,
          suffix,
          flagKey,
          org: orgId,
          product: productCode,
        }, 'FACS bypass: LaunchDarkly flag disabled for org');
        return fn(request, context);
      }
    } else {
      log.info({
        tag: 'facs',
        method,
        suffix,
        product: productCode,
      }, 'FACS: no LD flag entry for product — flag retired, enforcement universal');
    }

    // By the time we reach here, step 3 above has already established that
    // the route is in `productMap` (that's how `routeInThisProduct` became
    // true and we proceeded past the fail-closed gate). So the lookup must
    // succeed; if it ever didn't, the wrapper would have already bypassed
    // or 403'd above. resolveRouteCapability is called once more to hand
    // the matched permission array forward to the held-permission step.
    // Route values are validated at wrapper construction to be non-empty
    // `string[]` with any-of semantics.
    const requiredPermissions = resolveRouteCapability(context, productMap);

    // Held-permission resolution prefers a state-layer-exempt permission
    // when the user holds one — regardless of the route's listing order.
    // Without this, a user who legitimately holds both an exempt and a
    // brand-scoped permission (e.g. `llmo_manager` holds both `can_view_all`
    // and `can_view`) could be incorrectly forced through the state-layer
    // check if `can_view` happened to be listed first, denying the
    // universal access their exempt permission grants.
    //
    // The exempt set is per-product; missing or empty exempt sets reduce
    // this to plain first-match-wins.
    const exemptPermissions = exemptByProduct.get(productCode.toUpperCase());
    const heldExemptPermission = exemptPermissions?.size
      ? requiredPermissions.find(
        (p) => exemptPermissions.has(p) && authInfo?.hasFacsPermission?.(p),
      )
      : undefined;
    const heldPermission = heldExemptPermission
      ?? requiredPermissions.find((p) => authInfo?.hasFacsPermission?.(p));
    if (!heldPermission) {
      log.warn({
        tag: 'facs',
        permissions: requiredPermissions,
        user: resolveUserIdent(authInfo),
      }, 'FACS permission denied');
      return forbidden('Forbidden');
    }

    // Phase 2: state-layer (ReBAC) check.
    //
    // Short-circuit when the held permission is in the per-product exempt
    // list (e.g. llmo/can_view_all is global by design; llmo/can_manage_user
    // gates the management endpoints and must not recurse into the state
    // layer it manages). When the held permission was resolved by the exempt-
    // preference logic above, this `has(...)` check is guaranteed to be true;
    // it also catches the case where a non-exempt-prefers route happens to
    // resolve to an exempt held permission via plain first-match.
    if (exemptPermissions?.has(heldPermission)) {
      log.info({
        tag: 'facs',
        grant: 'state-layer-exempt',
        method,
        suffix,
        permission: heldPermission,
        product: productCode,
        org: orgId,
        user: resolveUserIdent(authInfo),
      }, 'FACS grant: state-layer-exempt permission held');
      return fn(request, context);
    }

    // Otherwise resolve the request's resource and require a matching mapping
    // (user-scoped OR org-scoped). Routes without a resolvable resource
    // (listings, global queries) skip the state-layer check entirely —
    // Phase 1 was sufficient.
    const routePattern = findMatchedRouteKey(context, productMap);
    const resource = resolveFacsResource({
      productCode: productCode.toUpperCase(),
      routePattern,
      params: context.pathInfo?.params,
      body: context.data,
      aliasLookupsPerProduct,
    });
    if (resource) {
      const postgrestClient = context.dataAccess?.services?.postgrestClient;
      if (!postgrestClient) {
        // No data-access wrapper in the chain → cannot read state layer.
        // Skip silently so non-postgrest deployments aren't affected; the
        // dataAccessWrapper is required upstream of facsWrapper for any
        // service that wants Phase 2 enforcement.
        log.info({
          tag: 'facs',
          grant: 'no-postgrest-client',
          method,
          suffix,
          permission: heldPermission,
          product: productCode,
          org: orgId,
          user: resolveUserIdent(authInfo),
        }, 'FACS grant: postgrestClient absent — skipping state-layer check');
        return fn(request, context);
      }

      const subjectUserId = resolveUserIdent(authInfo);
      // Try user-scoped binding first, fall back to org-scoped. Either is
      // sufficient — they're stored in the same table and read symmetrically.
      // The lookup carries no capability; capability was already established
      // by the Phase 1 JWT check. heldPermission is kept in forensic logs
      // (below) but is not part of the binding key.
      let mapping = null;
      try {
        mapping = subjectUserId
          ? await findFacsResourceBinding(postgrestClient, {
            subjectType: 'user',
            subjectId: subjectUserId,
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            imsOrgId: orgId,
          })
          : null;
        if (!mapping && orgId) {
          mapping = await findFacsResourceBinding(postgrestClient, {
            subjectType: 'org',
            subjectId: orgId,
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            imsOrgId: orgId,
          });
        }
      } catch (e) {
        // Fail closed — if the state-layer read errors, deny rather than
        // silently letting the request through. Surface the error so an
        // operator can diagnose; do not leak the message to the client.
        log.error({
          tag: 'facs',
          permission: heldPermission,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          user: subjectUserId,
          err: e.message,
        }, 'FACS state-layer read failed — denying');
        return forbidden('Forbidden');
      }
      if (!mapping) {
        log.warn({
          tag: 'facs',
          permission: heldPermission,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          via: resource.source,
          user: subjectUserId,
          org: orgId,
        }, 'FACS state-layer mapping not found — denying');
        return forbidden('Forbidden');
      }
      log.info({
        tag: 'facs',
        grant: 'state-layer-binding',
        method,
        suffix,
        permission: heldPermission,
        product: productCode,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        via: resource.source,
        user: subjectUserId,
        org: orgId,
      }, 'FACS grant: state-layer binding matched');
    } else {
      log.info({
        tag: 'facs',
        grant: 'no-resolvable-resource',
        method,
        suffix,
        permission: heldPermission,
        product: productCode,
        org: orgId,
        user: resolveUserIdent(authInfo),
      }, 'FACS grant: no resolvable resource — JWT permission check sufficient');
    }

    return fn(request, context);
  };
}
