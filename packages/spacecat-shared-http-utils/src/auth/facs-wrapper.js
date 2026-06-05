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
import { extractRouteParams, findMatchedRouteKey, resolveRouteCapability } from './route-utils.js';
import { buildAliasLookupsPerProduct, resolveFacsResource } from './facs-resource-resolver.js';
import { findFacsResourceBinding, normalizeImsOrgId } from './facs-state-layer.js';

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
 * Implements the **hybrid permission model** (see
 * `mysticat-architecture/platform/decisions/rebac-hybrid-permission-model.md`
 * and `mac-state-layer.md` §"State Layer Evaluation Engine"):
 *
 *     effectiveCapabilities(user, resource, product) =
 *         facsGrants(user, product)                    -- from JWT
 *       ∪ stateGrants(user, resource, product)         -- from facs_access_mappings
 *
 * The route's required capability must be a member of the effective set.
 * Grants are additive and grant-only — there is no deny record and no role
 * bundle; each capability is evaluated individually.
 *
 * ## `routeFacsCapabilities` shape
 *
 * ```
 * {
 *   INTERNAL_ROUTES: ['METHOD /path', ...],   // informational, ignored
 *   PRODUCTS_ROUTES: {
 *     LLMO: { 'METHOD /path': 'llmo/can_configure', ... }, // value: capability
 *     ASO:  { ... },
 *   },
 *   PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
 *     LLMO: { brand: ['brandId'] },
 *     ASO:  { site:  ['siteId']  },
 *   },
 * }
 * ```
 *
 * - Each route value is a single fully-qualified `<product>/<capability>`
 *   string. The hybrid model collapsed the previous any-of array semantics:
 *   one route guards one capability.
 * - The previous `PRODUCTS_FACS_ADMIN_PERMISSIONS` and
 *   `PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS` config keys are removed.
 *   Universal grants flow through the JWT claim; product-admin bypass and
 *   exempt lists are no longer part of the model.
 *
 * ## Bypass rules (fail-closed)
 *
 *   0. CORS preflight (`OPTIONS`) → bypass.
 *   1. Internal identities (admin, S2S, read-only admin, api-key) → bypass.
 *   2. Adobe internal IMS orgs (`FACS_EXCEPTION_INTERNAL_ORGS`) → bypass.
 *   3. Route NOT in any product map → bypass.
 *      Route IS in some product map but `x-product` is missing / mismatched
 *      → 403 (can't pick the right policy without the header).
 *   4. Per-product LaunchDarkly flag gate (off → bypass; ctor / eval fail
 *      → 503).
 *
 * After bypasses, the wrapper:
 *
 *   5. Resolves the request's ReBAC resource via `resolveFacsResource`. When
 *      the resolver returns `null` — either the product has no ReBAC scope,
 *      or the route is not scoped to a ReBAC entity — the wrapper **defers
 *      to the controller** (calls `fn(request, context)` unchanged). This
 *      handles both "no resource present" and "resource present but not
 *      ReBAC-scoped" symmetrically: the controller is the only layer with
 *      enough context to police those routes, and a deny here would block
 *      legitimate non-ReBAC traffic (e.g. LLMO suggestion writes that LLMO
 *      doesn't model as ReBAC entities).
 *
 *   6. Reads the active `facs_access_mappings` row for
 *      `(user, resource, org, product)`, then `(org, resource, org, product)`.
 *      Either is sufficient. The row's `granted_capabilities` are unioned
 *      with the JWT's `facs_permissions` to form the effective set.
 *
 *   7. Requires `routeCapability ∈ effectiveSet`. Missing → 403.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeFacsCapabilities: {
 *   INTERNAL_ROUTES?: string[],
 *   PRODUCTS_ROUTES: Object<string, Object<string, string>>,
 *   PRODUCTS_FACS_RESOURCE_PARAM_ALIASES?: Object<string, Object<string, string[]>>,
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

  // Validate every route value is a fully-qualified `<product>/<capability>`
  // string. Misconfigured maps fail at startup rather than the first request.
  for (const [product, routes] of Object.entries(productsRoutes)) {
    for (const [route, value] of Object.entries(routes || {})) {
      if (typeof value !== 'string' || !value.includes('/')) {
        throw new Error(
          `facsWrapper: ${product} '${route}' must be a fully-qualified `
          + `'<product>/<capability>' string, got ${JSON.stringify(value)}`,
        );
      }
    }
  }

  // Built once. Throws if a product declares the same alias under two
  // different resources — surfaces config typos at startup, not at request time.
  const aliasLookupsPerProduct = buildAliasLookupsPerProduct(
    routeFacsCapabilities.PRODUCTS_FACS_RESOURCE_PARAM_ALIASES,
  );

  return async (request, context) => {
    const { log } = context;

    const method = context.pathInfo?.method;
    const suffix = context.pathInfo?.suffix;

    // (0) CORS preflight bypass.
    if (method === 'OPTIONS') {
      log.info({
        tag: 'facs', bypass: 'options-preflight', method, suffix,
      }, 'FACS bypass: CORS preflight');
      return fn(request, context);
    }

    const authInfo = context.attributes?.authInfo;

    // (1) Internal identities bypass — FACS applies to external customers only.
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

    // Tenant scoping. getTenantIds() is multi-valued by claim but always
    // single-entry in the SpaceCat login flow; >1 is a misconfiguration.
    const tenantIds = authInfo?.getTenantIds?.() || [];
    if (tenantIds.length > 1) {
      log.error({
        tag: 'facs', tenantCount: tenantIds.length,
      }, 'authInfo.getTenantIds() returned more than one tenant — failing closed');
      return internalServerError('Multi-tenant sessions are not supported');
    }
    const orgId = tenantIds[0];

    // (2) Adobe internal IMS org IDs — permanent bypass (env-configured).
    const internalImsOrgIds = parseFacsExceptionInternalOrgs(context.env);
    if (orgId && internalImsOrgIds.has(orgId)) {
      log.info({
        tag: 'facs', bypass: 'internal-adobe-org', method, suffix, org: orgId,
      }, 'FACS bypass: Adobe internal IMS org');
      return fn(request, context);
    }

    // (3) FACS-governance gate based on x-product header + route membership.
    const productCode = context.pathInfo?.headers?.[X_PRODUCT_HEADER]?.toLowerCase();
    const productMap = productCode ? productsRoutes[productCode.toUpperCase()] : undefined;
    const routeInThisProduct = productMap && Object.keys(productMap).length > 0
      && resolveRouteCapability(context, productMap) !== null;

    if (!routeInThisProduct) {
      if (routeMatchesAnyProductMap(context, productsRoutes)) {
        log.warn({
          tag: 'facs', method, suffix, xProduct: productCode || null,
        }, 'FACS-governed route called without matching x-product — denying');
        return forbidden('x-product header required for FACS-governed routes');
      }
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
    const flagKey = FT_MAC_FACS_PERMISSIONS[productCode.toUpperCase()];
    if (flagKey) {
      if (!orgId) {
        log.warn({
          tag: 'facs', product: productCode,
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
        tag: 'facs', method, suffix, product: productCode,
      }, 'FACS: no LD flag entry for product — flag retired, enforcement universal');
    }

    // Route is in this product's sub-map (step 3 established this); the
    // lookup must succeed.
    const routeCapability = resolveRouteCapability(context, productMap);
    const upperProduct = productCode.toUpperCase();

    // (5) Resolve the ReBAC resource. When the resolver returns null — the
    // product has no ReBAC scope, or the route doesn't carry a ReBAC entity —
    // defer to the controller. We don't deny here: a route may legitimately
    // operate on entities the product hasn't modelled as ReBAC (e.g. LLMO
    // doesn't ReBAC-scope suggestions), and the controller is the only layer
    // with enough context to police those.
    const routePattern = findMatchedRouteKey(context, productMap);
    const routeParams = extractRouteParams(context, productMap);
    const resource = resolveFacsResource({
      productCode: upperProduct,
      routePattern,
      params: routeParams,
      body: context.data,
      query: context.pathInfo?.searchParams,
      aliasLookupsPerProduct,
    });

    if (!resource) {
      log.info({
        tag: 'facs',
        defer: 'no-resolvable-resource',
        method,
        suffix,
        capability: routeCapability,
        product: productCode,
        org: orgId,
        user: resolveUserIdent(authInfo),
      }, 'FACS defer-to-controller: no ReBAC-scoped resource for this request');
      return fn(request, context);
    }

    // (6) State-layer read — additive to the JWT. Tries user-scoped first,
    // then org-scoped; either is sufficient and they're stored symmetrically.
    const postgrestClient = context.dataAccess?.services?.postgrestClient;
    if (!postgrestClient) {
      // No data-access wrapper in the chain → cannot read state layer.
      // Fall back to the JWT-only effective set. The dataAccessWrapper is
      // required upstream of facsWrapper for any service that wants the
      // state-layer grants visible.
      const facsOnlyGranted = !!authInfo?.hasFacsPermission?.(routeCapability);
      if (facsOnlyGranted) {
        log.info({
          tag: 'facs',
          grant: 'jwt-only-no-postgrest',
          method,
          suffix,
          capability: routeCapability,
          product: productCode,
          org: orgId,
          user: resolveUserIdent(authInfo),
        }, 'FACS grant: JWT carries capability; postgrestClient absent, state layer skipped');
        return fn(request, context);
      }
      log.warn({
        tag: 'facs',
        capability: routeCapability,
        product: productCode,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        user: resolveUserIdent(authInfo),
      }, 'FACS denied: postgrestClient absent and JWT does not carry the route capability');
      return forbidden('Forbidden');
    }

    const subjectUserId = resolveUserIdent(authInfo);
    const canonicalImsOrgId = normalizeImsOrgId(orgId);
    let stateGrants = [];
    try {
      const lookupKey = {
        product: upperProduct,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        imsOrgId: canonicalImsOrgId,
      };
      const userMapping = subjectUserId
        ? await findFacsResourceBinding(postgrestClient, {
          ...lookupKey,
          subjectType: 'user',
          subjectId: subjectUserId,
        })
        : null;
      const orgMapping = canonicalImsOrgId
        ? await findFacsResourceBinding(postgrestClient, {
          ...lookupKey,
          subjectType: 'org',
          subjectId: canonicalImsOrgId,
        })
        : null;
      stateGrants = [
        ...(userMapping?.granted_capabilities || []),
        ...(orgMapping?.granted_capabilities || []),
      ];
    } catch (e) {
      // Fail closed on state-layer read errors.
      log.error({
        tag: 'facs',
        capability: routeCapability,
        product: productCode,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        user: subjectUserId,
        err: e.message,
      }, 'FACS state-layer read failed — denying');
      return forbidden('Forbidden');
    }

    // (7) Effective set: JWT facs_permissions ∪ state-layer granted_capabilities.
    const jwtGrants = !!authInfo?.hasFacsPermission?.(routeCapability);
    const stateGranted = stateGrants.includes(routeCapability);
    if (!jwtGrants && !stateGranted) {
      log.warn({
        tag: 'facs',
        capability: routeCapability,
        product: productCode,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        via: resource.source,
        user: subjectUserId,
        org: canonicalImsOrgId,
        stateGrantsCount: stateGrants.length,
      }, 'FACS denied: capability not in effective set (JWT ∪ state-layer)');
      return forbidden('Forbidden');
    }

    log.info({
      tag: 'facs',
      grant: jwtGrants ? 'jwt' : 'state-layer',
      method,
      suffix,
      capability: routeCapability,
      product: productCode,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      via: resource.source,
      user: subjectUserId,
      org: canonicalImsOrgId,
    }, 'FACS grant: capability is in effective set');

    return fn(request, context);
  };
}
