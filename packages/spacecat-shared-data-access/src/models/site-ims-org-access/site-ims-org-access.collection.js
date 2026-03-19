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

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';
import { DEFAULT_PAGE_SIZE } from '../../util/postgrest.utils.js';

/**
 * SiteImsOrgAccessCollection - Collection of cross-org delegation grants.
 * Provides idempotent create and the 50-delegate-per-site limit.
 *
 * @class SiteImsOrgAccessCollection
 * @extends BaseCollection
 */
class SiteImsOrgAccessCollection extends BaseCollection {
  static COLLECTION_NAME = 'SiteImsOrgAccessCollection';

  static MAX_DELEGATES_PER_SITE = 50;

  /**
   * Idempotent create: if a grant already exists for (siteId, organizationId, productCode),
   * return the existing record. Otherwise, enforce the 50-delegate-per-site limit and create.
   * Follows the SiteEnrollment pattern (site-enrollment.collection.js:25-32).
   *
   * Note: the findByIndexKeys + allBySiteId + super.create sequence is not atomic. Concurrent
   * requests can both pass the idempotency check (creating duplicates) or both pass the limit
   * check (exceeding it). A DB-level unique constraint on (siteId, organizationId, productCode)
   * is the authoritative guard against duplicates.
   */
  async create(item, options = {}) {
    if (item?.organizationId && item?.targetOrganizationId
      && item.organizationId === item.targetOrganizationId) {
      const message = 'Cannot create self-delegation: organizationId and targetOrganizationId must differ';
      this.log.warn(`[SiteImsOrgAccess] Self-delegation rejected: org=${item.organizationId}`);
      const err = new DataAccessError(message);
      err.status = 409;
      throw err;
    }

    if (item?.siteId && item?.organizationId && item?.productCode) {
      const existing = await this.findByIndexKeys({
        siteId: item.siteId,
        organizationId: item.organizationId,
        productCode: item.productCode,
      });
      if (existing) {
        this.log.info(`[SiteImsOrgAccess] Idempotent create: returning existing grant for site=${item.siteId} org=${item.organizationId} product=${item.productCode}`);
        return existing;
      }
    }

    // Enforce 50-active-delegate-per-site limit; expired grants do not count.
    if (item?.siteId) {
      const allGrants = await this.allBySiteId(item.siteId);
      const activeGrants = allGrants.filter(
        (g) => !g.getExpiresAt() || new Date(g.getExpiresAt()) > new Date(),
      );
      if (activeGrants.length >= SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE) {
        const message = `Cannot add delegate: site already has ${activeGrants.length}/${SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE} active delegates`;
        this.log.warn(`[SiteImsOrgAccess] Delegate limit reached for site=${item.siteId}`);
        const err = new DataAccessError(message);
        err.status = 409;
        throw err;
      }
    }

    const created = await super.create(item, options);
    this.log.info(`[SiteImsOrgAccess] New grant created: id=${created.getId()} site=${item.siteId} org=${item.organizationId} product=${item.productCode}`);
    return created;
  }

  /**
   * Returns all grants for the given delegate organization with the target organization's
   * id and imsOrgId embedded via PostgREST resource embedding (INNER JOIN). This avoids
   * a separate batch query to resolve target org IMS identifiers.
   *
   * Returns plain objects, not model instances. Access properties directly
   * (e.g., `entry.grant.productCode`, `entry.targetOrganization.imsOrgId`).
   *
   * @param {string} organizationId - UUID of the delegate organization.
   * @returns {Promise<Array<{
   *   grant: {id: string, siteId: string, organizationId: string,
   *     targetOrganizationId: string, productCode: string, role: string,
   *     grantedBy: string|null, expiresAt: string|null},
   *   targetOrganization: {id: string, imsOrgId: string}
   * }>>}
   */
  /**
   * @param {object} query - PostgREST query builder (result of .from(...).select(...))
   * @returns {Promise<Array<{grant: object, targetOrganization: object}>>}
   * @private
   */
  async #fetchGrantsWithTargetOrg(query) {
    const allResults = [];
    let offset = 0;
    let keepGoing = true;

    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await query.order('id').range(offset, offset + DEFAULT_PAGE_SIZE - 1);

      if (error) {
        this.log.error(`[SiteImsOrgAccess] Failed to query grants with target org - ${error.message}`, error);
        throw new DataAccessError(
          'Failed to query grants with target organization',
          { entityName: 'SiteImsOrgAccess', tableName: 'site_ims_org_accesses' },
          error,
        );
      }

      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        allResults.push(...data);
        keepGoing = data.length >= DEFAULT_PAGE_SIZE;
        offset += DEFAULT_PAGE_SIZE;
      }
    }

    return allResults.map((row) => ({
      grant: {
        id: row.id,
        siteId: row.site_id,
        organizationId: row.organization_id,
        targetOrganizationId: row.target_organization_id,
        productCode: row.product_code,
        role: row.role,
        grantedBy: row.granted_by,
        expiresAt: row.expires_at,
      },
      targetOrganization: {
        id: row.organizations.id,
        imsOrgId: row.organizations.ims_org_id,
      },
    }));
  }

  /**
   * Returns all grants for the given delegate organization with the target organization's
   * id and imsOrgId embedded via PostgREST resource embedding (INNER JOIN). This avoids
   * a separate batch query to resolve target org IMS identifiers.
   *
   * Returns plain objects, not model instances. Access properties directly
   * (e.g., `entry.grant.productCode`, `entry.targetOrganization.imsOrgId`).
   *
   * @param {string} organizationId - UUID of the delegate organization.
   * @returns {Promise<Array<{
   *   grant: {id: string, siteId: string, organizationId: string,
   *     targetOrganizationId: string, productCode: string, role: string,
   *     grantedBy: string|null, expiresAt: string|null},
   *   targetOrganization: {id: string, imsOrgId: string}
   * }>>}
   */
  async allByOrganizationIdWithTargetOrganization(organizationId) {
    if (!organizationId) {
      throw new DataAccessError('organizationId is required', { entityName: 'SiteImsOrgAccess', tableName: 'site_ims_org_accesses' });
    }
    // eslint-disable-next-line max-len
    const select = 'id, site_id, organization_id, target_organization_id, product_code, role, granted_by, expires_at, organizations!site_ims_org_accesses_target_organization_id_fkey(id, ims_org_id)';
    return this.#fetchGrantsWithTargetOrg(
      this.postgrestService.from('site_ims_org_accesses').select(select).eq('organization_id', organizationId),
    );
  }

  /**
   * Bulk variant of allByOrganizationIdWithTargetOrganization. Fetches grants for multiple
   * delegate organizations in a single PostgREST IN query with target org embedding.
   * Returns an empty array when organizationIds is empty.
   *
   * @param {string[]} organizationIds - UUIDs of the delegate organizations.
   * @returns {Promise<Array<{
   *   grant: {id: string, siteId: string, organizationId: string,
   *     targetOrganizationId: string, productCode: string, role: string,
   *     grantedBy: string|null, expiresAt: string|null},
   *   targetOrganization: {id: string, imsOrgId: string}
   * }>>}
   */
  async allByOrganizationIdsWithTargetOrganization(organizationIds) {
    if (!organizationIds || organizationIds.length === 0) {
      return [];
    }
    // eslint-disable-next-line max-len
    const select = 'id, site_id, organization_id, target_organization_id, product_code, role, granted_by, expires_at, organizations!site_ims_org_accesses_target_organization_id_fkey(id, ims_org_id)';
    return this.#fetchGrantsWithTargetOrg(
      this.postgrestService.from('site_ims_org_accesses').select(select).in('organization_id', organizationIds),
    );
  }
}

export default SiteImsOrgAccessCollection;
