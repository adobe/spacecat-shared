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
 * Checks whether the authenticated read-only admin user owns the resource identified
 * by the path parameters or request body. Ownership is determined by whether the user's
 * IMS org matches the organization that owns the referenced site or organization entity.
 *
 * ID resolution order:
 * 1. Named path params (e.g. :siteId, :organizationId, :spaceCatId) — always preferred.
 *    spaceCatId is an alias for organizationId used by /v2/orgs/:spaceCatId/* routes
 *    in spacecat-api-service.
 * 2. context.data (parsed request body) — used only when the matched route has no path
 *    params at all (e.g. POST /preflight/jobs passes siteId in the body). Requires that
 *    the body-parser wrapper runs before readOnlyAdminWrapper in the .with() chain.
 *
 * Fail-closed: returns false if dataAccess is unavailable, the entity is not found,
 * no recognizable ID can be resolved, or any lookup throws.
 *
 * @param {Object} context - Universal context (must have context.dataAccess and context.log)
 * @param {Object} authInfo - The AuthInfo instance for the current user
 * @param {Object<string, string>} params - Named path params extracted from the route pattern
 * @returns {Promise<boolean>}
 */
async function isOwnerOfResource(context, authInfo, params) {
  const { dataAccess, log } = context;
  if (!dataAccess) {
    log.error({ tag: 'ro-admin' }, 'isOwnerOfResource: dataAccess not on context — ensure dataAccessWrapper runs before readOnlyAdminWrapper');
    return false;
  }

  // Body fallback only when the route carries no path params at all (e.g. POST /preflight/jobs).
  // When params has keys, the route does have path identifiers; relying on body data in that
  // case could allow a caller to spoof ownership by naming params differently than :siteId.
  const hasPathParams = Object.keys(params).length > 0;
  const siteId = hasPathParams ? params.siteId : context.data?.siteId;
  const organizationId = hasPathParams
    ? (params.organizationId ?? params.spaceCatId)
    : (context.data?.organizationId ?? context.data?.spaceCatId);

  try {
    if (siteId) {
      const site = await dataAccess.Site?.findById(siteId);
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
      const org = await dataAccess.Organization?.findById(organizationId);
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
    log.error({ tag: 'ro-admin', err }, 'Error checking resource ownership for RO admin');
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
    log.error({ tag: 'ro-admin', err }, 'Feature flag evaluation failed for RO admin; defaulting to deny');
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
 * 1. Evaluates the `FT_READ_ONLY_ORG` LaunchDarkly feature flag (fail-closed).
 * 2. For read routes (capability 'read' or 'readAll'): allows immediately without an
 *    ownership DB lookup — capability alone permits.
 * 3. For write routes and unmapped routes (all non-read capabilities, including null):
 *    performs an ownership check on the referenced resource. Ownership is resolved from
 *    path params first (:siteId, :organizationId, :spaceCatId) and falls back to the
 *    request body (context.data) only when the matched route has no path params at all.
 *    This allows RO admins to operate on their own resources even when the specific
 *    route has no entry in routeCapabilities — the key invariant is ownership, not
 *    capability mapping. Routes with no resolvable resource ID are denied.
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
 * - Handlers behind body-fallback authorization MUST only mutate the declared
 *   siteId/organizationId resource; the wrapper cannot verify what the handler does
 *   with other fields in the request body.
 *
 * @param {Function} fn - The handler to wrap.
 * @param {{ routeCapabilities: Object<string, string>, internalRoutes?: string[] }} opts -
 *   routeCapabilities: required map of route patterns to action strings ('read' | 'write').
 *   internalRoutes: optional array of route pattern strings (e.g. 'DELETE /sites/:siteId')
 *   for routes that exist in the service but are not listed in routeCapabilities. Used as a
 *   fallback by extractRouteParams so ownership checks can still resolve path params for
 *   unmapped routes instead of falling back to the request body.
 * @returns {Function} A wrapped handler.
 */
export function readOnlyAdminWrapper(fn, { routeCapabilities, internalRoutes = [] } = {}) {
  if (!routeCapabilities) {
    throw new Error('readOnlyAdminWrapper: routeCapabilities is required');
  }
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
        }, 'Feature flag disabled, denying RO admin access');
        return forbidden('Forbidden');
      }

      if (isObject(routeCapabilities)) {
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
            // Write or unmapped route: verify ownership of the referenced resource.
            // Ownership is the governing invariant — a null/absent capability is not an
            // automatic deny; it means the route is not mapped, but RO admins who own
            // the resource may still perform the operation. Routes with no resolvable
            // resource ID (no path param and no body siteId/organizationId) fail-closed.
            const isOwner = await isOwnerOfResource(context, authInfo, params);
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
              log.info({
                tag: 'ro-admin-access',
                email: authInfo.getProfile?.()?.email,
                method: context.pathInfo?.method,
                suffix: context.pathInfo?.suffix,
                org: authInfo.getTenantIds?.()[0],
                resolvedSiteId: hasPathParams
                  ? (params.siteId ?? null)
                  : (context.data?.siteId ?? null),
                resolvedOrgId: hasPathParams
                  ? (params.organizationId ?? params.spaceCatId ?? null)
                  : (context.data?.organizationId ?? context.data?.spaceCatId ?? null),
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
          log.error({ tag: 'ro-admin', err }, 'Unexpected error in RO admin authorization; denying access');
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
    }

    return fn(request, context);
  };
}
