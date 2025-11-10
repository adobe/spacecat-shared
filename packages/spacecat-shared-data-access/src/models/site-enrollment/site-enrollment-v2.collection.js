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
 * SiteEnrollmentV2Collection - A class representing a collection of SiteEnrollmentV2 entities.
 * Version 2 uses entitlementId as partition key and siteId as sort key.
 * Provides methods to query and manipulate collections of SiteEnrollment data.
 *
 * When creating a V2 enrollment, it also creates the corresponding original SiteEnrollment
 * for backwards compatibility during migration.
 *
 * @class SiteEnrollmentV2Collection
 * @extends BaseCollection
 */
class SiteEnrollmentV2Collection extends BaseCollection {
  /**
   * Creates a new SiteEnrollmentV2 entity and also creates the corresponding
   * original SiteEnrollment for backwards compatibility.
   *
   * @async
   * @param {Object} item - The data for the entity to be created.
   * @param {Object} [options] - Additional options for the creation process.
   * @returns {Promise<BaseModel>} - A promise that resolves to the created V2 model instance.
   * @throws {DataAccessError} - Throws an error if the creation process fails.
   */
  async create(item, options = {}) {
    // Create the original SiteEnrollment first for backwards compatibility
    const SiteEnrollmentCollection = this.entityRegistry.getCollection('SiteEnrollmentCollection');
    await SiteEnrollmentCollection.create({
      siteId: item.siteId,
      entitlementId: item.entitlementId,
      updatedBy: item.updatedBy || 'system',
    }, options);

    this.log.info(`Created original SiteEnrollment for siteId: ${item.siteId}, entitlementId: ${item.entitlementId}`);

    // Create the V2 enrollment after the original
    let v2Enrollment;
    try {
      v2Enrollment = await super.create(item, options);
      this.log.info(`Created V2 SiteEnrollment for siteId: ${item.siteId}, entitlementId: ${item.entitlementId}`);
    } catch (error) {
      this.log.error(`Failed to create V2 SiteEnrollment: ${error.message}`, error);
      // We don't throw here - original creation succeeded, which is what matters
    }

    return v2Enrollment;
  }
}

export default SiteEnrollmentV2Collection;
