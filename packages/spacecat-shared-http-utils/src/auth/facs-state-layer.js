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

/**
 * Default IMS authentication source suffix used when normalising bare tenant
 * idents into the canonical `<ident>@<authSrc>` form expected on
 * `facs_access_mappings.ims_org_id`. This matches the hardcoded `@AdobeOrg`
 * suffix already used elsewhere in the codebase (see `readOnlyAdminWrapper`
 * and the `LaunchDarklyClient.isFlagEnabledForIMSOrg` call site in
 * `facs-wrapper.js`).
 */
const DEFAULT_IMS_AUTH_SRC = 'AdobeOrg';

/**
 * Normalises a tenant ident into the canonical `<ident>@<authSrc>` form the
 * state-layer schema stores in `facs_access_mappings.ims_org_id` (see
 * `platform/decisions/mac-state-layer.md` §"Org identifier"). `getTenantIds()`
 * returns the bare ident, so every state-layer read / write must pass through
 * this helper first; without it the lookup filter never matches the stored
 * rows and resource-scoped requests fail-closed even though a binding exists.
 *
 * Idempotent: when the input already carries an `@<authSrc>` suffix it is
 * returned unchanged. Returns empty / null inputs unchanged so callers can
 * chain without branching.
 */
export function normalizeImsOrgId(orgIdent, authSrc = DEFAULT_IMS_AUTH_SRC) {
  if (!orgIdent) {
    return orgIdent;
  }
  if (typeof orgIdent !== 'string') {
    return orgIdent;
  }
  return orgIdent.includes('@') ? orgIdent : `${orgIdent}@${authSrc}`;
}

/**
 * Resource-binding lookup against `facs_access_mappings` used by `facsWrapper`
 * under the hybrid permission model. Returns the active mapping row's
 * `granted_capabilities` when the subject is bound to the resource within the
 * supplied org and product, otherwise `null`.
 *
 * Under the hybrid model the state layer DOES carry capability: each row
 * stores `granted_capabilities text[]` (e.g.
 * `['llmo/can_configure', 'llmo/can_deploy']`). The wrapper unions these with
 * the JWT `facs_permissions` claim to compute the effective capability set
 * for the request (see `mac-state-layer.md` §"State Layer Evaluation Engine").
 *
 * Backed by the partial active-row index
 * `facs_access_mappings_active_by_subject` on
 * `(ims_org_id, product, subject_type, subject_id) WHERE revoked_at IS NULL`,
 * so the read is an index-only O(log n) point read.
 *
 * @param {object} postgrestClient - From `context.dataAccess.services.postgrestClient`.
 * @param {object} keys
 * @param {string} keys.imsOrgId - Canonical `<ident>@<authSrc>` form.
 * @param {string} keys.product - Upper-cased product code, e.g. `'LLMO'`.
 * @param {'user'|'org'} keys.subjectType
 * @param {string} keys.subjectId
 * @param {string} keys.resourceType - Canonical, e.g. `'brand'`.
 * @param {string} keys.resourceId
 * @returns {Promise<{id: string, granted_capabilities: string[]}|null>}
 */
export async function findFacsResourceBinding(postgrestClient, {
  imsOrgId,
  product,
  subjectType,
  subjectId,
  resourceType,
  resourceId,
}) {
  const { data, error } = await postgrestClient
    .from('facs_access_mappings')
    .select('id, granted_capabilities')
    .eq('ims_org_id', imsOrgId)
    .eq('product', product)
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`findFacsResourceBinding failed: ${error.message}`);
  }
  return data ?? null;
}
