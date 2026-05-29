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
import { LaunchDarklyClient } from '@adobe/spacecat-shared-launchdarkly-client';

import { FF_READ_ONLY_ORG } from './constants.js';
import {
  extractRouteParams,
  guardNonEmptyRouteCapabilities,
  resolveRouteCapability,
} from './route-utils.js';

function forbidden(message) {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-error': message },
  });
}

/**
 * Resolves a canonical identifier (e.g. 'siteId', 'organizationId') from a source map,
 * preferring the canonical key, then trying any configured aliases that map to it.
 *
 * @param {Object|undefined} source - Path params or context.data
 * @param {string} canonical - Canonical key name ('siteId' or 'organizationId')
 * @param {Object<string, string>} aliases - Alias map (alias name -> canonical name)
 * @returns {string|null} The resolved id, or null
 */
function resolveId(source, canonical, aliases) {
  if (!source) {
    return null;
  }
  if (source[canonical] !== undefined) {
    return source[canonical];
  }
  for (const [alias, target] of Object.entries(aliases)) {
    if (target === canonical && source[alias] !== undefined) {
      return source[alias];
    }
  }
  return null;
}

/**
 * Checks whether the authenticated read-only admin user owns the resource identified
 * by the path parameters or request body. Ownership is determined by whether the user's
 * IMS org matches the organization that owns the referenced site or organization entity.
 *
 * ID resolution order:
 * 1. Named path params (e.g. :siteId, :organizationId, or any alias configured via
 *    paramAliases such as :spaceCatId -> organizationId) — always preferred.
 * 2. context.data (parsed request body) — used only when the matched route has no path
 *    params at all (e.g. POST /preflight/jobs passes siteId in the body). Requires that
 *    the body-parser wrapper runs before readOnlyAdminWrapper in the .with() chain.
 *
 * Precedence: siteId wins over organizationId when both are resolvable; the site lookup
 * is performed and organizationId is ignored. Routes that surface both should rely on
 * siteId as the canonical owner reference.
 *
 * Fail-closed: returns false if dataAccess is unavailable, the entity is not found,
 * no recognizable ID can be resolved, or any lookup throws.
 *
 * @param {Object} context - Universal context (must have context.dataAccess and context.log)
 * @param {Object} authInfo - The AuthInfo instance for the current user
 * @param {Object<string, string>} params - Named path params extracted from the route pattern
 * @param {Object<string, string>} paramAliases - Alias map for canonical id resolution
 * @returns {Promise<boolean>}
 */
async function isOwnerOfResource(context, authInfo, params, paramAliases) {
  const { dataAccess, log } = context;
  if (!dataAccess) {
    log.error({ tag: 'ro-admin' }, 'isOwnerOfResource: dataAccess not on context — ensure dataAccessWrapper runs before readOnlyAdminWrapper');
    return false;
  }

  // Body fallback only when the route carries no path params at all (e.g. POST /preflight/jobs).
  // When params has keys, the route does have path identifiers; relying on body data in that
  // case could allow a caller to spoof ownership by naming params differently than :siteId.
  const hasPathParams = Object.keys(params).length > 0;
  const source = hasPathParams ? params : context.data;
  const siteId = resolveId(source, 'siteId', paramAliases);
  const organizationId = resolveId(source, 'organizationId', paramAliases);

  try {
    if (siteId) {
      if (!dataAccess.Site) {
        log.error({ tag: 'ro-admin' }, 'isOwnerOfResource: dataAccess.Site accessor is missing');
        return false;
      }
      const site = await dataAccess.Site.findById(siteId);
      if (!site) {
        return false;
      }
      const org = await site.getOrganization();
      if (!org) {
        return false;
      }
      const imsOrgId = org.getImsOrgId();
      if (!imsOrgId) {
        log.warn({ tag: 'ro-admin', siteId }, 'Owning organization has no imsOrgId; denying RO admin access');
        return false;
      }
      return authInfo.hasOrganization(imsOrgId);
    }

    if (organizationId) {
      if (!dataAccess.Organization) {
        log.error({ tag: 'ro-admin' }, 'isOwnerOfResource: dataAccess.Organization accessor is missing');
        return false;
      }
      const org = await dataAccess.Organization.findById(organizationId);
      if (!org) {
        return false;
      }
      const imsOrgId = org.getImsOrgId();
      if (!imsOrgId) {
        log.warn({ tag: 'ro-admin', organizationId }, 'Organization has no imsOrgId; denying RO admin access');
        return false;
      }
      return authInfo.hasOrganization(imsOrgId);
    }
  } catch (err) {
    log.error({
      tag: 'ro-admin',
      errMessage: err.message,
      errName: err.name,
    }, 'Error checking resource ownership for RO admin');
    return false;
  }

  log.warn({
    tag: 'ro-admin',
    method: context.pathInfo?.method,
    suffix: context.pathInfo?.suffix,
  }, 'isOwnerOfResource: no siteId or organizationId found in path params or context.data');
  return false;
}

/**
 * Evaluates the read-only admin feature flag for the authenticated user's IMS org.
 * Uses {@link AuthInfo#getTenantIds} to resolve the org and
 * {@link LaunchDarklyClient#isFlagEnabledForIMSOrg} for evaluation.
 *
 * Tenant scoping semantics: this is a USER-ORG GATE. The flag is evaluated against the
 * user's primary tenant (`getTenantIds()[0]`). For a multi-tenant user whose tenant list
 * is `[A, B]`, the flag state for A decides access; B is not consulted. This is order-
 * dependent: the same user with tenant list `[B, A]` would be gated by B's flag state.
 * Resource-level org membership is enforced separately by the subsequent ownership check.
 *
 * Fail-closed: returns false when the client/org is unavailable or evaluation errors.
 *
 * @param {Object} context - Universal context (lambda context)
 * @param {Object} authInfo - The AuthInfo instance for the current user
 * @returns {Promise<boolean>}
 */
async function evaluateFeatureFlag(context, authInfo) {
  const { log } = context;
  try {
    const ldClient = LaunchDarklyClient.createFrom(context);
    if (!ldClient) {
      return false;
    }

    const tenantIds = authInfo.getTenantIds?.() || [];
    const ident = tenantIds[0];
    if (!ident) {
      return false;
    }

    const imsOrgId = `${ident}@AdobeOrg`;
    return await ldClient.isFlagEnabledForIMSOrg(FF_READ_ONLY_ORG, imsOrgId);
  } catch (err) {
    log.error({
      tag: 'ro-admin',
      errMessage: err.message,
      errName: err.name,
    }, 'Feature flag evaluation failed for RO admin; defaulting to deny');
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
 * 1. Evaluates the `FT_READ_ONLY_ORG` LaunchDarkly feature flag (fail-closed). See
 *    {@link evaluateFeatureFlag} for tenant scoping semantics (user-org gate).
 * 2. For read routes (capability 'read' or 'readAll'): allows immediately without an
 *    ownership DB lookup — capability alone permits.
 * 3. For write routes and unmapped routes (all non-read capabilities, including null):
 *    performs an ownership check on the referenced resource. Ownership is resolved from
 *    path params first (:siteId, :organizationId, plus any aliases declared in
 *    paramAliases). It falls back to the request body (context.data) only when the
 *    matched route has no path params AND the route has an explicit non-null capability
 *    mapping. Unmapped routes (capability === null) with no path params are denied:
 *    body-claimed ownership cannot be trusted when the wrapper has no record of the
 *    route. This is defense-in-depth on top of consumer-side route exhaustiveness tests.
 * 4. Emits a structured access log (tag: ro-admin-access) when an allowed write is
 *    authorized by ownership. Emits an audit log (tag: ro-admin-audit) for all other
 *    allowed RO admin requests where an access log was not already emitted.
 *
 * Non-RO-admin requests pass through untouched.
 *
 * Wiring requirements (ordering within the .with() chain):
 * - `dataAccessWrapper` must run before this wrapper so context.dataAccess is available.
 * - The body-parser wrapper must run before this wrapper for routes that authorize from
 *   context.data (collection writes where siteId/organizationId is in the body).
 *
 * Handler contracts (the wrapper authorizes but does not enforce these — the handler must):
 * - Body-fallback authorization: handlers MUST only mutate the declared siteId/
 *   organizationId resource named in the body; the wrapper cannot verify what the
 *   handler does with other fields.
 * - Nested path params: when a route surfaces multiple resource ids (e.g.
 *   PATCH /sites/:siteId/audits/:auditId), the wrapper authorizes on the parent
 *   (siteId). Handlers MUST verify that nested resource ids belong to the authorized
 *   parent (e.g. confirm audit.siteId === params.siteId) before mutating them.
 *
 * Sibling wrappers:
 * - {@link s2sAuthWrapper} consumes the same `routeCapabilities` shape but uses a
 *   strict capability gate (no ownership fallback). Their policies differ deliberately:
 *   RO admin permits owner-on-unmapped routes via the body-fallback restriction above;
 *   s2s denies anything not explicitly mapped.
 *
 * Performance: every RO admin write incurs a DB round trip for the ownership lookup
 * (Site.findById + getOrganization() is two; Organization.findById is one). Read
 * routes are not affected (read fast-path).
 *
 * @param {Function} fn - The handler to wrap.
 * @param {Object} opts - Wrapper options.
 * @param {Object<string, string>} opts.routeCapabilities - Required map of route
 *   patterns (e.g. 'GET /sites/:siteId') to capability strings (e.g. 'site:read',
 *   'site:write'). Must be a non-empty plain object.
 * @param {string[]} [opts.internalRoutes=[]] - Route pattern strings for routes that
 *   exist in the service but are not listed in routeCapabilities. Used as a fallback
 *   by extractRouteParams so ownership can resolve path params for unmapped routes
 *   instead of denying. Consumers are expected to maintain a complete enumeration of
 *   routes across routeCapabilities + internalRoutes (test-enforced at the call site).
 * @param {Object<string, string>} [opts.paramAliases={}] - Map of alias param names to
 *   canonical names, e.g. { spaceCatId: 'organizationId' }. Lets a consumer's route
 *   conventions (e.g. /v2/orgs/:spaceCatId) be authorized as the canonical resource
 *   id without coupling this shared library to a specific service's routing.
 * @returns {Function} A wrapped handler.
 */
export function readOnlyAdminWrapper(fn, {
  routeCapabilities,
  internalRoutes = [],
  paramAliases = {},
} = {}) {
  guardNonEmptyRouteCapabilities('readOnlyAdminWrapper', routeCapabilities);

  return async (request, context) => {
    const { log } = context;
    const authInfo = context.attributes?.authInfo;

    if (authInfo?.isReadOnlyAdmin?.()) {
      const ffEnabled = await evaluateFeatureFlag(context, authInfo);
      if (!ffEnabled) {
        log.warn({
          tag: 'ro-admin',
          email: authInfo.getProfile?.()?.email,
          org: authInfo.getTenantIds?.()[0],
          reason: 'feature-flag-disabled',
        }, 'Feature flag disabled, denying RO admin access');
        return forbidden('Forbidden');
      }

      let accessLogged = false;
      try {
        const params = extractRouteParams(context, routeCapabilities, internalRoutes);
        const hasPathParams = Object.keys(params).length > 0;
        const capability = resolveRouteCapability(context, routeCapabilities);
        // capability format: 'resource:action' (e.g. 'site:read', 'site:write').
        // split(':').pop() extracts the action; a missing or malformed value yields
        // undefined, which is not a read action and correctly triggers the ownership check.
        const action = capability?.split(':').pop();

        if (action !== 'read' && action !== 'readAll') {
          // Defense-in-depth: deny body-fallback authorization on unmapped routes.
          // When the route is in NEITHER routeCapabilities NOR internalRoutes (capability
          // is null AND no path params were extracted), the body's siteId claim cannot
          // be trusted: the wrapper has no record of the route, so it cannot constrain
          // what the handler may do with body data. Legitimate body-fallback routes
          // (e.g. POST /preflight/jobs) are unaffected because they have an explicit
          // capability mapping.
          if (capability === null && !hasPathParams) {
            log.warn({
              tag: 'ro-admin',
              reason: 'unmapped-no-path-params',
              method: context.pathInfo?.method,
              suffix: context.pathInfo?.suffix,
              org: authInfo.getTenantIds?.()[0],
            }, 'RO admin denied on unmapped route with no path params; add this route to routeCapabilities or internalRoutes');
            return forbidden('Forbidden');
          }

          // Write or unmapped-with-path-params route: verify ownership of the referenced
          // resource. For unmapped routes that carry path params (resolved via
          // internalRoutes), ownership is the governing invariant — RO admins who own
          // the resource may still perform the operation. A `unmapped-route-allowed`
          // drift warn is emitted so consumers can detect routeCapabilities drift.
          const isOwner = await isOwnerOfResource(context, authInfo, params, paramAliases);
          if (isOwner) {
            if (capability === null) {
              log.warn({
                tag: 'ro-admin',
                reason: 'unmapped-route-allowed',
                method: context.pathInfo?.method,
                suffix: context.pathInfo?.suffix,
                org: authInfo.getTenantIds?.()[0],
              }, 'RO admin allowed on unmapped route via ownership — add this route to routeCapabilities');
            }
            const resolvedSiteId = hasPathParams
              ? resolveId(params, 'siteId', paramAliases)
              : resolveId(context.data, 'siteId', paramAliases);
            const resolvedOrgId = hasPathParams
              ? resolveId(params, 'organizationId', paramAliases)
              : resolveId(context.data, 'organizationId', paramAliases);
            log.info({
              tag: 'ro-admin-access',
              email: authInfo.getProfile?.()?.email,
              method: context.pathInfo?.method,
              suffix: context.pathInfo?.suffix,
              org: authInfo.getTenantIds?.()[0],
              resolvedSiteId,
              resolvedOrgId,
              idSource: hasPathParams ? 'path' : 'body',
            }, 'RO admin access allowed on owned resource');
            accessLogged = true;
          } else {
            log.warn({
              tag: 'ro-admin',
              email: authInfo.getProfile?.()?.email,
              method: context.pathInfo?.method,
              suffix: context.pathInfo?.suffix,
              org: authInfo.getTenantIds?.()[0],
              reason: 'not-owner',
            }, 'Read-only admin blocked from route');
            return forbidden('Forbidden');
          }
        }
        // Read action: capability alone permits — no ownership DB lookup needed.
      } catch (err) {
        log.error({
          tag: 'ro-admin',
          errMessage: err.message,
          errName: err.name,
        }, 'Unexpected error in RO admin authorization; denying access');
        return forbidden('Forbidden');
      }

      // Emit audit log only when the richer access log was not already emitted
      // (i.e. for reads and any path where ownership-based access was not recorded).
      if (!accessLogged) {
        log.info({
          tag: 'ro-admin-audit',
          email: authInfo.getProfile?.()?.email,
          method: context.pathInfo?.method,
          suffix: context.pathInfo?.suffix,
          org: authInfo.getTenantIds?.()[0],
        }, 'RO admin accessed route');
      }
    }

    return fn(request, context);
  };
}
