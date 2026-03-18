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
   */
  async create(item, options = {}) {
    if (item?.siteId && item?.organizationId && item?.productCode) {
      const existing = await this.findByIndexKeys({
        siteId: item.siteId,
        organizationId: item.organizationId,
        productCode: item.productCode,
      });
      if (existing) return existing;
    }

    // Enforce 50-delegate-per-site limit
    if (item?.siteId) {
      const existingGrants = await this.allBySiteId(item.siteId);
      if (existingGrants.length >= SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE) {
        const err = new Error(
          `Cannot add delegate: site already has ${existingGrants.length}/${SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE} delegates`,
        );
        err.status = 409;
        throw err;
      }
    }

    return super.create(item, options);
  }
}

export default SiteImsOrgAccessCollection;
