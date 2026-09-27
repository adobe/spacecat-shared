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

import { hasText, isInteger, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';
import { uuidv7 } from '../../util/uuid.js';

/**
 * Maps a raw abv_onboarding_claims row (snake_case, as returned by the RPCs)
 * to a camelCase claim object. The computed `acquired` flag is intentionally
 * dropped -- it is returned separately by `acquire`.
 *
 * @param {object} row - Raw RPC row.
 * @returns {object} The mapped claim.
 */
const toClaim = (row) => ({
  id: row.id,
  imsOrgId: row.ims_org_id,
  baseURL: row.base_url,
  status: row.status,
  factId: row.fact_id,
  holder: row.holder,
  leaseExpiresAt: row.lease_expires_at,
  artifacts: row.artifacts,
  reason: row.reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * AbvOnboardingClaimCollection - Manages the abv_onboarding_claims table (SITES-52547).
 *
 * The durable per-(imsOrgId, baseURL) ABV onboarding claim is the executor's idempotency
 * marker and concurrency lease. All mutations go through the three SECURITY DEFINER RPCs
 * (wrpc_acquire_abv_claim / wrpc_finalize_abv_claim / wrpc_invalidate_abv_claim); there is
 * no direct row read/write. The model mints the per-attempt `holder` token on `acquire`.
 *
 * @class AbvOnboardingClaimCollection
 * @extends BaseCollection
 */
class AbvOnboardingClaimCollection extends BaseCollection {
  static COLLECTION_NAME = 'AbvOnboardingClaimCollection';

  /**
   * Atomically creates or reclaims the per-(imsOrgId, baseURL) claim via the
   * wrpc_acquire_abv_claim RPC. The model mints the per-attempt `holder` token.
   *
   * @async
   * @param {object} params
   * @param {string} params.imsOrgId - IMS org id of the onboarding target.
   * @param {string} params.baseURL - Normalized base URL of the onboarding target.
   * @param {string} [params.factId] - BEP provisioning fact id of this attempt.
   * @param {number} params.leaseMs - Lease duration in milliseconds (positive integer).
   * @returns {Promise<{ acquired: boolean, claim: object }>} - The (possibly blocking)
   *   claim and whether it was acquired by this attempt.
   * @throws {DataAccessError} - On invalid input or RPC failure.
   */
  async acquire({
    imsOrgId, baseURL, factId, leaseMs,
  } = {}) {
    if (!hasText(imsOrgId) || !hasText(baseURL)) {
      throw new DataAccessError('acquire: imsOrgId and baseURL are required', this);
    }
    if (!isInteger(leaseMs) || leaseMs <= 0) {
      throw new DataAccessError('acquire: leaseMs must be a positive integer (milliseconds)', this);
    }

    const holder = uuidv7();
    const { data, error } = await this.postgrestService.rpc('wrpc_acquire_abv_claim', {
      p_ims_org_id: imsOrgId,
      p_base_url: baseURL,
      p_fact_id: factId ?? null,
      p_lease_ms: leaseMs,
      p_holder: holder,
    });

    if (error) {
      this.log.error('acquire: RPC failed', error);
      throw new DataAccessError('Failed to acquire ABV onboarding claim (wrpc_acquire_abv_claim)', this, error);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) {
      throw new DataAccessError('acquire: wrpc_acquire_abv_claim returned no row', this);
    }

    return { acquired: Boolean(row.acquired), claim: toClaim(row) };
  }

  /**
   * Sets a terminal status on the claim via the wrpc_finalize_abv_claim RPC, conditional
   * (server-side) on the caller still being the current holder with a live lease. The RPC
   * no-ops when the holder no longer matches. `artifacts` are persisted only for COMPLETED.
   *
   * @async
   * @param {object} claim - The claim previously returned by `acquire` (carries `holder`).
   * @param {object} opts
   * @param {string} opts.status - Terminal status: COMPLETED | FAILED | CONFLICT.
   * @param {object} [opts.artifacts] - Landing artifacts { siteId, entitlementId } (COMPLETED).
   * @param {string} [opts.reason] - Reason for a FAILED/CONFLICT terminal status.
   * @returns {Promise<void>}
   * @throws {DataAccessError} - On invalid input or RPC failure.
   */
  async finalize(claim, { status, artifacts, reason } = {}) {
    if (!isNonEmptyObject(claim)
      || !hasText(claim.imsOrgId) || !hasText(claim.baseURL) || !hasText(claim.holder)) {
      throw new DataAccessError('finalize: a claim with imsOrgId, baseURL and holder is required', this);
    }

    const { error } = await this.postgrestService.rpc('wrpc_finalize_abv_claim', {
      p_ims_org_id: claim.imsOrgId,
      p_base_url: claim.baseURL,
      p_holder: claim.holder,
      p_status: status,
      p_artifacts: artifacts ?? null,
      p_reason: reason ?? null,
    });

    if (error) {
      this.log.error('finalize: RPC failed', error);
      throw new DataAccessError('Failed to finalize ABV onboarding claim (wrpc_finalize_abv_claim)', this, error);
    }
  }

  /**
   * Deletes the per-(imsOrgId, baseURL) claim via the wrpc_invalidate_abv_claim RPC.
   * Called by the ABV offboard flow so a later re-onboard is not falsely short-circuited.
   *
   * @async
   * @param {object} params
   * @param {string} params.imsOrgId - IMS org id of the onboarding target.
   * @param {string} params.baseURL - Normalized base URL of the onboarding target.
   * @returns {Promise<void>}
   * @throws {DataAccessError} - On invalid input or RPC failure.
   */
  async invalidate({ imsOrgId, baseURL } = {}) {
    if (!hasText(imsOrgId) || !hasText(baseURL)) {
      throw new DataAccessError('invalidate: imsOrgId and baseURL are required', this);
    }

    const { error } = await this.postgrestService.rpc('wrpc_invalidate_abv_claim', {
      p_ims_org_id: imsOrgId,
      p_base_url: baseURL,
    });

    if (error) {
      this.log.error('invalidate: RPC failed', error);
      throw new DataAccessError('Failed to invalidate ABV onboarding claim (wrpc_invalidate_abv_claim)', this, error);
    }
  }
}

export default AbvOnboardingClaimCollection;
