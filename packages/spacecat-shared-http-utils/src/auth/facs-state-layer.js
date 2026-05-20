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
 * Point-read against `facs_access_mappings` used by `facsWrapper` Phase 2.
 *
 * Lives next to the wrapper (and not in api-service) because every service
 * that mounts `facsWrapper` issues the exact same query against the exact
 * same table — the schema lives in `mysticat-data-service` and is fixed.
 * One source of truth here keeps the wrapper-side authorisation logic in
 * lock-step with the table shape.
 *
 * Single composite index on
 * `(ims_org_id, subject_type, subject_id, facs_permission,
 *   resource_type, resource_id)` makes this O(log n).
 *
 * @param {object} postgrestClient - From `context.dataAccess.services.postgrestClient`.
 * @param {object} keys
 * @param {string} keys.imsOrgId
 * @param {'user'|'org'} keys.subjectType
 * @param {string} keys.subjectId
 * @param {string} keys.facsPermission - Fully-qualified, e.g. `'llmo/can_configure'`.
 * @param {string} keys.resourceType   - Canonical, e.g. `'brand'`.
 * @param {string} keys.resourceId
 * @returns {Promise<object|null>}
 */
export async function findFacsAccessMapping(postgrestClient, {
  imsOrgId,
  subjectType,
  subjectId,
  facsPermission,
  resourceType,
  resourceId,
}) {
  const { data, error } = await postgrestClient
    .from('facs_access_mappings')
    .select('*')
    .eq('ims_org_id', imsOrgId)
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .eq('facs_permission', facsPermission)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`findFacsAccessMapping failed: ${error.message}`);
  }
  return data ?? null;
}
