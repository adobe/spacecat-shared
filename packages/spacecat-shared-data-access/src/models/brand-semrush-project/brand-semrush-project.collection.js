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

import { isValidUUID } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';
import { DEFAULT_PAGE_SIZE } from '../../util/postgrest.utils.js';

const BRAND_FK = 'brand_to_semrush_projects_brand_id_fkey';

// Safety cutoff for #fetchOrgRows' pagination loop. The per-FK base-collection
// queries this package generates elsewhere are naturally bounded (one brand's
// rows); this org-level fan-out is not, so an unexpectedly large org (or a
// runaway loop from an accessor bug) is capped rather than growing memory
// unbounded. Not expected to be hit in practice — see the truncation log.
const MAX_ORG_ROWS = 50_000;

/**
 * BrandSemrushProjectCollection - collection of BrandSemrushProject rows.
 *
 * Tombstone contract: only `allByOrganizationId` filters `deletedAt` by
 * default. Every other accessor here (including the auto-generated
 * `allByBrandId` / `findBySemrushProjectId`) returns tombstoned rows
 * alongside live ones — there is no package-level soft-delete scope. Callers
 * that need only live rows must filter explicitly, or use the sanctioned
 * accessor. See serenity-docs brand-semrush-mapping-maintenance.md §7.2.
 *
 * @class BrandSemrushProjectCollection
 * @extends BaseCollection
 */
class BrandSemrushProjectCollection extends BaseCollection {
  static COLLECTION_NAME = 'BrandSemrushProjectCollection';

  /**
   * Find the single row for a (brand, geoTargetId, languageCode) slice, or
   * null. Used by spacecat-api-service POST /v2/orgs/.../serenity/markets to
   * 409 on a duplicate slice before calling the upstream.
   *
   * Returns tombstoned rows too (see class doc) — flat mode never tombstones,
   * so this only matters for sub-workspace callers, which do not use this
   * method today.
   *
   * @param {string} brandId
   * @param {number} geoTargetId Google Ads Geo Target ID.
   * @param {string} languageCode BCP-47 primary subtag.
   * @returns {Promise<BrandSemrushProject|null>}
   */
  async findBySlice(brandId, geoTargetId, languageCode) {
    return this.findByIndexKeys({ brandId, geoTargetId, languageCode });
  }

  /**
   * Returns identity rows (brand/project/slice/site, plus the embedded
   * sub-workspace id) for every mapping row under the given organization, via
   * a single PostgREST embedded-join query (INNER JOIN on brand_id FK) — one
   * round trip, no per-brand fan-out. This is the sanctioned read path for
   * cross-team consumers (spec §7.2): it deliberately returns plain frozen
   * identity DTOs, not model instances, so a consumer cannot update/remove
   * through it or reach beyond the projected columns.
   *
   * Tombstones are filtered by default (`deletedAt IS NULL`) — pass
   * `{ includeDeleted: true }` to see them (e.g. for history/debugging).
   *
   * @param {string} organizationId - UUID of the organization.
   * @param {object} [options]
   * @param {boolean} [options.includeDeleted=false]
   * @returns {Promise<Array<{
   *   brandId: string,
   *   semrushProjectId: string,
   *   geoTargetId: number,
   *   languageCode: string,
   *   siteId: string|null,
   *   organizationId: string|null,
   *   semrushSubWorkspaceId: string|null,
   * }>>}
   */
  async allByOrganizationId(organizationId, { includeDeleted = false } = {}) {
    if (!organizationId || !isValidUUID(organizationId)) {
      throw new DataAccessError(
        'organizationId is required and must be a valid UUID',
        { entityName: this.entityName, tableName: this.tableName },
      );
    }

    // `!inner` is explicit rather than relying on the implicit INNER-JOIN-on-
    // embedded-filter behavior added in PostgREST v11 — on an older server the
    // same `.eq('brands.organization_id', ...)` filter alone is a LEFT JOIN,
    // returning every mapping row with `brands: null` for non-matching
    // organizations instead of excluding them.
    // eslint-disable-next-line max-len
    const select = `brand_id, semrush_project_id, semrush_location_id, language, site_id, brands!${BRAND_FK}!inner(organization_id, semrush_sub_workspace_id)`;
    let query = this.postgrestService.from(this.tableName).select(select)
      .eq('brands.organization_id', organizationId);
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    return this.#fetchOrgRows(query);
  }

  /**
   * @param {object} query - PostgREST query builder
   * @returns {Promise<Array<object>>}
   * @private
   */
  async #fetchOrgRows(query) {
    const allResults = [];
    let offset = 0;
    let keepGoing = true;
    // Secondary sort on semrush_project_id: brand_id alone does not give a
    // stable page boundary when one brand has many projects (rows within a
    // brand could otherwise straddle a page split in a different order on
    // each call). semrush_project_id is unique per row, so this fully
    // determines row order.
    const orderedQuery = query.order('brand_id').order('semrush_project_id');

    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await orderedQuery.range(offset, offset + DEFAULT_PAGE_SIZE - 1);

      if (error) {
        this.log.error(`[${this.entityName}] Failed to query mapping rows by organization - ${error.message}`, error);
        throw new DataAccessError(
          'Failed to query mapping rows by organization',
          { entityName: this.entityName, tableName: this.tableName },
          error,
        );
      }

      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        allResults.push(...data);
        offset += DEFAULT_PAGE_SIZE;
        if (allResults.length >= MAX_ORG_ROWS) {
          this.log.warn(`[${this.entityName}] allByOrganizationId truncated at ${MAX_ORG_ROWS} rows`);
          keepGoing = false;
        } else {
          keepGoing = data.length >= DEFAULT_PAGE_SIZE;
        }
      }
    }

    return allResults.map((row) => Object.freeze({
      brandId: row.brand_id,
      semrushProjectId: row.semrush_project_id,
      geoTargetId: row.semrush_location_id,
      languageCode: row.language,
      siteId: row.site_id ?? null,
      organizationId: row.brands?.organization_id ?? null,
      semrushSubWorkspaceId: row.brands?.semrush_sub_workspace_id ?? null,
    }));
  }
}

export default BrandSemrushProjectCollection;
