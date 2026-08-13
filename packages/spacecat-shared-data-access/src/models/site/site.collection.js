/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { hasText, isValidHelixPreviewUrl, isValidUrl } from '@adobe/spacecat-shared-utils';

import DataAccessError from '../../errors/data-access.error.js';
import BaseCollection from '../base/base.collection.js';
import {
  applyWhere,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  toDbField,
} from '../../util/postgrest.utils.js';

import Site, { AEM_CS_HOST, getAuthoringType } from './site.model.js';

/**
 * SiteCollection - A collection class responsible for managing Site entities.
 * Extends the BaseCollection to provide specific methods for interacting with Site records.
 *
 * @class SiteCollection
 * @extends BaseCollection
 */
class SiteCollection extends BaseCollection {
  static COLLECTION_NAME = 'SiteCollection';

  async allSitesToAudit() {
    return (await this.all({}, { attributes: ['siteId'] })).map((site) => site.getId());
  }

  async allWithLatestAudit(auditType, order = 'asc', deliveryType = null) {
    if (!hasText(auditType)) {
      throw new DataAccessError('auditType is required', this);
    }

    const latestAuditCollection = this.entityRegistry.getCollection('LatestAuditCollection');

    const sitesQuery = Object.values(Site.DELIVERY_TYPES)
      .includes(deliveryType)
      ? this.allByDeliveryType(deliveryType)
      : this.all();

    const [sites, latestAudits] = await Promise.all([
      sitesQuery,
      latestAuditCollection.all({ auditType }, { order }),
    ]);

    const sitesMap = new Map(sites.map((site) => [site.getId(), site]));
    const orderedSites = [];
    const cacheKey = `getLatestAuditByAuditType:["${auditType}"]`;
    // getLatestAuditByAuditType:["cwv"]

    // First, append sites with a latest audit in the sorted order
    latestAudits.forEach((audit) => {
      const site = sitesMap.get(audit.getSiteId());
      if (site) {
        // eslint-disable-next-line no-underscore-dangle
        site._accessorCache[cacheKey] = audit;
        orderedSites.push(site);
        sitesMap.delete(site.getId()); // Remove the site from the map to avoid adding it again
      }
    });

    // Then, append the remaining sites (without a latest audit)
    sitesMap.forEach((site) => {
      // eslint-disable-next-line no-underscore-dangle,no-param-reassign
      site._accessorCache[cacheKey] = null;
      orderedSites.push(site);
    });

    return orderedSites;
  }

  async findByPreviewURL(previewURL) {
    if (!isValidUrl(previewURL)) {
      throw new DataAccessError(`Invalid preview URL: ${previewURL}`, this);
    }

    const { hostname } = new URL(previewURL);
    const previewType = getAuthoringType(hostname, Site.AUTHORING_TYPES);

    switch (previewType) {
      case Site.AUTHORING_TYPES.SP:
      case Site.AUTHORING_TYPES.GD:
      case Site.AUTHORING_TYPES.DA: {
        if (!isValidHelixPreviewUrl(previewURL)) {
          throw new DataAccessError(`Invalid Helix preview URL: ${previewURL}`, this);
        }
        const [host] = hostname.split('.');
        const [, site, owner] = host.split('--');
        return this.findByExternalOwnerIdAndExternalSiteId(owner, site);
      }
      case Site.AUTHORING_TYPES.CS_CW:
      case Site.AUTHORING_TYPES.CS: {
        const [, programId, envId] = AEM_CS_HOST.exec(hostname);
        const externalOwnerId = `p${programId}`;
        const externalSiteId = `e${envId}`;
        return this.findByExternalOwnerIdAndExternalSiteId(externalOwnerId, externalSiteId);
      }
      default:
        throw new DataAccessError(`Unsupported preview URL: ${previewURL}`, this);
    }
  }

  async allByProjectName(projectName) {
    if (!hasText(projectName)) {
      throw new DataAccessError('projectName is required', this);
    }

    const projectCollection = this.entityRegistry.getCollection('ProjectCollection');
    const project = await projectCollection.findByProjectName(projectName);

    if (!project) {
      return [];
    }
    return this.allByProjectId(project.getId());
  }

  async allByOrganizationIdAndProjectId(organizationId, projectId) {
    if (!hasText(organizationId)) {
      throw new DataAccessError('organizationId is required', this);
    }
    if (!hasText(projectId)) {
      throw new DataAccessError('projectId is required', this);
    }

    const organizationCollection = this.entityRegistry.getCollection('OrganizationCollection');
    const organization = await organizationCollection.findById(organizationId);

    if (!organization) {
      return [];
    }

    const projectCollection = this.entityRegistry.getCollection('ProjectCollection');
    const projects = await projectCollection.allByOrganizationId(organizationId);
    const project = projects.find((p) => p.getId() === projectId);

    if (!project) {
      return [];
    }

    return this.allByProjectId(projectId);
  }

  /**
   * Returns all sites enrolled in a given product (e.g. 'LLMO', 'ASO').
   * Uses entityRegistry to chain through EntitlementCollection and SiteEnrollmentCollection,
   * then batch-fetches full Site objects.
   *
   * @param {string} productCode - Product code to filter by (e.g. 'LLMO').
   * @returns {Promise<Site[]>}
   */
  async allByEnrollmentProductCode(productCode, options = {}) {
    if (!hasText(productCode)) {
      throw new DataAccessError('productCode is required', this);
    }

    const siteEnrollmentCollection = this.entityRegistry.getCollection('SiteEnrollmentCollection');

    // Query 1: get all site IDs enrolled in the given product (single JOIN query)
    const siteIds = await siteEnrollmentCollection.allSiteIdsByProductCode(productCode);
    if (siteIds.length === 0) {
      return [];
    }

    // Query 2: batch-fetch Site objects (caller controls which fields to fetch)
    const { data: sites } = await this.batchGetByKeys(
      siteIds.map((siteId) => ({ siteId })),
      options,
    );
    return sites;
  }

  /**
   * Returns all sites enrolled at a given entitlement tier (e.g. 'PAID',
   * 'FREE_TRIAL', 'PLG'). Optionally narrows the result to a single product
   * code (e.g. 'LLMO').
   *
   * Uses entityRegistry to chain through SiteEnrollmentCollection, then
   * batch-fetches full Site objects.
   *
   * @param {string} tier - Entitlement tier to filter by.
   * @param {string} [productCode] - Optional product code to further filter by.
   * @param {object} [options] - batchGetByKeys options (e.g. attribute projection).
   * @returns {Promise<Site[]>}
   */
  async allByEnrollmentAndTier(tier, productCode, options = {}) {
    if (!hasText(tier)) {
      throw new DataAccessError('tier is required', this);
    }

    const siteEnrollmentCollection = this.entityRegistry.getCollection('SiteEnrollmentCollection');

    const siteIds = await siteEnrollmentCollection.allSiteIdsByTier(tier, productCode);
    if (siteIds.length === 0) {
      return [];
    }

    const { data: sites } = await this.batchGetByKeys(
      siteIds.map((siteId) => ({ siteId })),
      options,
    );
    return sites;
  }

  /**
   * Returns sites filtered by entitlement tier and/or product code, paginated,
   * and composable with a caller-supplied `where` and `orderBy` — all in a
   * SINGLE PostgREST query via a two-level inner-join embed
   * (sites -> site_enrollments -> entitlements).
   *
   * PostgREST resource embedding NESTS matching children under each parent row
   * (it does not flatten into a cartesian product), so `.range()` offset
   * pagination stays correct over DISTINCT parent sites even when a site has
   * multiple matching enrollments. `!inner` at both embed levels turns the
   * embedded filter into an INNER JOIN, excluding sites with no matching
   * enrollment/entitlement (a plain embedded filter is a LEFT JOIN on older
   * PostgREST servers, which would return non-matching sites with an empty
   * embed instead of dropping them).
   *
   * Kept symmetric with `Site.all(..., { returnCursor: true, limit })`: it
   * honors the EXACT `limit` passed (no silent cap, no +1) because the
   * api-service caller does N+1 hasMore detection (passes `limit =
   * effectiveLimit + 1` and slices), and returns `{ data, cursor }` when
   * `returnCursor` is set, else a bare array. This lets the controller call it
   * almost identically to `Site.all`.
   *
   * @param {object} [filter]
   * @param {string} [filter.tier] - Entitlement tier (e.g. 'PAID', 'FREE_TRIAL').
   * @param {string} [filter.productCode] - Entitlement product code (e.g. 'LLMO').
   *   At least one of `tier` / `productCode` is required.
   * @param {object} [options]
   * @param {Function} [options.where] - Caller `where` fn `(attrs, op) => expr`
   *   applied to the sites table (e.g. baseURL substring / deliveryType / isLive).
   * @param {object} [options.orderBy] - `{ attribute, direction }`; defaults to
   *   `updatedAt` desc. Always followed by an `id` tiebreaker for stable paging.
   * @param {number} [options.limit] - Max parent rows to return (exact).
   * @param {string} [options.cursor] - Base64 offset cursor (see decodeCursor).
   * @param {boolean} [options.returnCursor] - Return `{ data, cursor }` shape.
   * @returns {Promise<Site[] | { data: Site[], cursor: string|null }>}
   */
  async allByEnrollmentFiltered(
    { tier, productCode } = {},
    {
      where, orderBy, limit, cursor, returnCursor,
    } = {},
  ) {
    if (!hasText(tier) && !hasText(productCode)) {
      throw new DataAccessError('tier or productCode is required', this);
    }

    // The embed must be selected for PostgREST to filter on it. The nested
    // array PostgREST returns per site is stripped below before hydrating the
    // Site model (the Site model has no such attribute).
    const select = '*, site_enrollments!inner(entitlements!inner(tier, product_code))';

    let query = this.postgrestService
      .from(this.tableName)
      .select(select);

    if (hasText(tier)) {
      query = query.eq('site_enrollments.entitlements.tier', tier);
    }
    if (hasText(productCode)) {
      query = query.eq('site_enrollments.entitlements.product_code', productCode);
    }

    // Caller-supplied where composes on the sites table
    // (base_url / delivery_type / is_live).
    query = applyWhere(query, where, this.fieldMaps.toDbMap);

    // Ordering mirrors base.collection #queryPage: a primary sort (default
    // updatedAt desc) plus a stable id tiebreaker so page boundaries never
    // straddle equal sort keys. An explicit orderBy is validated the same way
    // Site.all does — a clear error beats an opaque PostgREST 400 (unknown
    // column) or a silently-wrong sort direction.
    const hasOrderBy = hasText(orderBy?.attribute);
    let orderField = 'updated_at';
    let ascending = false;
    if (hasOrderBy) {
      const { toDbMap } = this.fieldMaps;
      if (!Object.prototype.hasOwnProperty.call(toDbMap, orderBy.attribute)) {
        throw new DataAccessError(`unknown orderBy attribute: ${orderBy.attribute}`, this);
      }
      const direction = orderBy.direction === undefined
        ? 'asc'
        : String(orderBy.direction).toLowerCase();
      if (direction !== 'asc' && direction !== 'desc') {
        throw new DataAccessError(`invalid orderBy direction: ${orderBy.direction}`, this);
      }
      orderField = toDbField(orderBy.attribute, toDbMap);
      ascending = direction === 'asc';
    }
    query = query.order(orderField, { ascending });
    const idField = this.fieldMaps.toDbMap[this.idName];
    if (idField !== orderField) {
      query = query.order(idField, { ascending });
    }

    // Honor the exact limit (no cap, no +1) so the api-service N+1 hasMore
    // detection stays symmetric with Site.all's postgrest path.
    const effectiveLimit = Number.isInteger(limit) ? limit : DEFAULT_PAGE_SIZE;
    const offset = decodeCursor(cursor);
    query = query.range(offset, offset + effectiveLimit - 1);

    const { data, error } = await query;
    if (error) {
      this.log.error(`[SiteCollection] Failed to query sites by enrollment filter - ${error.message}`, error);
      throw new DataAccessError('Failed to query sites by enrollment filter', this, error);
    }

    const instances = (data || []).map((row) => {
      // Drop the embed PostgREST nests on each parent row so it cannot leak
      // onto the hydrated Site record.
      const siteRow = { ...row };
      delete siteRow.site_enrollments;
      return this.createInstanceFromRow(siteRow);
    });

    if (returnCursor) {
      const nextCursor = instances.length === effectiveLimit
        ? encodeCursor(offset + effectiveLimit)
        : null;
      return { data: instances, cursor: nextCursor };
    }

    return instances;
  }

  async allByOrganizationIdAndProjectName(organizationId, projectName) {
    if (!hasText(organizationId)) {
      throw new DataAccessError('organizationId is required', this);
    }
    if (!hasText(projectName)) {
      throw new DataAccessError('projectName is required', this);
    }

    const organizationCollection = this.entityRegistry.getCollection('OrganizationCollection');
    const organization = await organizationCollection.findById(organizationId);

    if (!organization) {
      return [];
    }

    const projectCollection = this.entityRegistry.getCollection('ProjectCollection');
    const projects = await projectCollection.allByOrganizationId(organizationId);
    const project = projects.find((p) => p.getProjectName() === projectName);

    if (!project) {
      return [];
    }

    return this.allByProjectId(project.getId());
  }
}

export default SiteCollection;
