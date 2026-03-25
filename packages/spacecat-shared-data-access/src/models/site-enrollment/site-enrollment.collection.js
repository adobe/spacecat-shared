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
 * SiteEnrollmentCollection - A class representing a collection of SiteEnrollment entities.
 * Provides methods to query and manipulate collections of SiteEnrollment data.
 *
 * @class SiteEnrollmentCollection
 * @extends BaseCollection
 */
class SiteEnrollmentCollection extends BaseCollection {
  static COLLECTION_NAME = 'SiteEnrollmentCollection';

  /**
   * Returns all site IDs enrolled in a given product code in a single JOIN query.
   *
   * @param {string} productCode - Product code to filter by (e.g. 'LLMO').
   * @returns {Promise<string[]>} Array of siteId strings.
   */
  async allSiteIdsByProductCode(productCode) {
    if (!productCode) {
      throw new DataAccessError('productCode is required', { entityName: 'SiteEnrollment', tableName: 'site_enrollments' });
    }

    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .select('site_id, entitlements!inner(product_code)')
      .eq('entitlements.product_code', productCode);

    if (error) {
      this.log.error(`[SiteEnrollmentCollection] Failed to query site_enrollments by productCode - ${error.message}`, error);
      throw new DataAccessError('Failed to query site_enrollments by productCode', { entityName: 'SiteEnrollment', tableName: 'site_enrollments' }, error);
    }

    return (data || []).map((row) => row.site_id);
  }

  async create(item, options = {}) {
    if (item?.siteId && item?.entitlementId) {
      const existing = await this.findByIndexKeys({
        siteId: item.siteId,
        entitlementId: item.entitlementId,
      });
      if (existing) return existing;
    }

    return super.create(item, options);
  }
}

export default SiteEnrollmentCollection;
