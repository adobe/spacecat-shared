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
 * Resource-binding check against `facs_access_mappings` used by `facsWrapper`
 * Phase 2. Returns the active mapping row when the subject is scoped to the
 * resource within the supplied org, otherwise `null`.
 *
 * The state layer does NOT store capability — capability is decided by FACS /
 * MacGiver at login and embedded in the JWT `facs_permissions` claim. This
 * helper answers the orthogonal scope question only: *is this subject bound
 * to this resource in this org?* Both must be true for the wrapper to admit
 * the request (JWT permission + active binding).
 *
 * Lives next to the wrapper (and not in api-service) because every service
 * that mounts `facsWrapper` issues the exact same query against the exact
 * same table — the schema lives in `mysticat-data-service` and is fixed.
 * One source of truth here keeps the wrapper-side authorisation logic in
 * lock-step with the table shape.
 *
 * Backed by the partial active-row index
 * `facs_access_mappings_active_by_subject` on
 * `(ims_org_id, subject_type, subject_id) WHERE revoked_at IS NULL`, so
 * tombstones don't bloat the lookup and this is an O(log n) point read.
 *
 * @param {object} postgrestClient - From `context.dataAccess.services.postgrestClient`.
 * @param {object} keys
 * @param {string} keys.imsOrgId
 * @param {'user'|'org'} keys.subjectType
 * @param {string} keys.subjectId
 * @param {string} keys.resourceType - Canonical, e.g. `'brand'`.
 * @param {string} keys.resourceId
 * @returns {Promise<{id: string}|null>} Row when an active binding exists, otherwise `null`.
 */
export async function findFacsResourceBinding(postgrestClient, {
  imsOrgId,
  subjectType,
  subjectId,
  resourceType,
  resourceId,
}) {
  const { data, error } = await postgrestClient
    .from('facs_access_mappings')
    .select('id')
    .eq('ims_org_id', imsOrgId)
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
