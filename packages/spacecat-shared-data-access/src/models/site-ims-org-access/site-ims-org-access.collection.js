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
   * Shared pagination loop for PostgREST embedding queries. Fetches all pages and maps
   * each row using the provided mapper function.
   *
   * @param {object} query - PostgREST query builder (result of .from(...).select(...))
   * @param {Function} mapRow - Maps a raw row to the desired return shape
   * @param {string} errorMessage - Used for logging and DataAccessError message
   * @returns {Promise<Array>}
   * @private
   */
  async #fetchPaginatedGrants(query, mapRow, errorMessage) {
    const allResults = [];
    let offset = 0;
    let keepGoing = true;
    const orderedQuery = query.order('id');

    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await orderedQuery.range(offset, offset + DEFAULT_PAGE_SIZE - 1);

      if (error) {
        this.log.error(`[SiteImsOrgAccess] ${errorMessage} - ${error.message}`, error);
        throw new DataAccessError(
          errorMessage,
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

    return allResults.map(mapRow);
  }

  /**
   * @param {object} query - PostgREST query builder
   * @returns {Promise<Array<{grant: SiteImsOrgAccess, targetOrganization: object}>>}
   * @private
   */
  async #fetchGrantsWithTargetOrg(query) {
    return this.#fetchPaginatedGrants(
      query,
      (row) => ({
        grant: this.createInstanceFromRow(row),
        targetOrganization: { id: row.organizations.id, imsOrgId: row.organizations.ims_org_id },
      }),
      'Failed to query grants with target organization',
    );
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
    if (organizationIds.length > SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE) {
      throw new DataAccessError(
        `allByOrganizationIdsWithTargetOrganization: organizationIds array exceeds maximum of ${SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE}`,
        { entityName: 'SiteImsOrgAccess', tableName: 'site_ims_org_accesses' },
      );
    }
    // eslint-disable-next-line max-len
    const select = 'id, site_id, organization_id, target_organization_id, product_code, role, granted_by, expires_at, organizations!site_ims_org_accesses_target_organization_id_fkey(id, ims_org_id)';
    return this.#fetchGrantsWithTargetOrg(
      this.postgrestService.from('site_ims_org_accesses').select(select).in('organization_id', organizationIds),
    );
  }

  /**
   * Finds a single grant by the compound key (siteId, organizationId, productCode).
   * Used by hasAccess() in the api-service to verify a grant still exists (Path A revocation
   * check) or to perform a direct DB lookup when the JWT list was truncated (Path B).
   *
   * Returns a model instance so callers can use getExpiresAt(), getRole(), etc.
   * Returns null when no matching grant exists.
   *
   * @param {string} siteId - UUID of the site.
   * @param {string} organizationId - UUID of the delegate organization.
   * @param {string} productCode - Product code (e.g. 'LLMO', 'ASO').
   * @returns {Promise<SiteImsOrgAccess|null>}
   */
  async findBySiteIdAndOrganizationIdAndProductCode(siteId, organizationId, productCode) {
    if (!siteId || !organizationId || !productCode) {
      throw new DataAccessError(
        'siteId, organizationId and productCode are required',
        { entityName: 'SiteImsOrgAccess', tableName: 'site_ims_org_accesses' },
      );
    }
    return this.findByIndexKeys({ siteId, organizationId, productCode });
  }

  /**
   * Returns all grants for the given delegate organization with the full site row embedded
   * via PostgREST resource embedding (INNER JOIN on site_id FK). This is a single round-trip
   * query — no N+1 — suitable for populating the site dropdown for delegated users.
   *
   * Returns plain objects, not model instances. The `site` field contains the raw PostgREST
   * row for the joined site (snake_case column names). It is null only when the FK is broken,
   * which should not occur given ON DELETE CASCADE on site_id.
   *
   * @param {string} organizationId - UUID of the delegate organization.
   * @returns {Promise<Array<{
   *   grant: {id: string, siteId: string, organizationId: string,
   *     targetOrganizationId: string, productCode: string, role: string,
   *     grantedBy: string|null, expiresAt: string|null},
   *   site: object|null
   * }>>}
   */
  async allByOrganizationIdWithSites(organizationId) {
    if (!organizationId) {
      throw new DataAccessError('organizationId is required', { entityName: 'SiteImsOrgAccess', tableName: 'site_ims_org_accesses' });
    }
    // eslint-disable-next-line max-len
    const select = 'id, site_id, organization_id, target_organization_id, product_code, role, granted_by, expires_at, sites!site_ims_org_accesses_site_id_fkey(*)';
    return this.#fetchGrantsWithSite(
      this.postgrestService.from('site_ims_org_accesses').select(select).eq('organization_id', organizationId),
    );
  }

  /**
   * @param {object} query - PostgREST query builder
   * @returns {Promise<Array<{grant: SiteImsOrgAccess, site: Site|null}>>}
   * @private
   */
  async #fetchGrantsWithSite(query) {
    const siteCollection = this.entityRegistry.getCollection('SiteCollection');
    return this.#fetchPaginatedGrants(
      query,
      (row) => ({
        grant: this.createInstanceFromRow(row),
        site: row.sites ? siteCollection.createInstanceFromRow(row.sites) : null,
      }),
      'Failed to query grants with site',
    );
  }
}

export default SiteImsOrgAccessCollection;
