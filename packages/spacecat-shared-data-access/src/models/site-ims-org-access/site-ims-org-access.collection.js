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
}

export default SiteImsOrgAccessCollection;
