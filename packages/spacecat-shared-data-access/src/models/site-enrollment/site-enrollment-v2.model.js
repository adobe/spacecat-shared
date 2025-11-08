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

import BaseModel from '../base/base.model.js';

/**
 * SiteEnrollmentV2 - A class representing a SiteEnrollmentV2 entity.
 * Version 2 uses entitlementId as partition key and siteId as sort key.
 * Provides methods to access and manipulate SiteEnrollment-specific data.
 *
 * @class SiteEnrollmentV2
 * @extends BaseModel
 */
class SiteEnrollmentV2 extends BaseModel {
  // add your custom methods or overrides here
  generateCompositeKeys() {
    return {
      entitlementId: this.getEntitlementId(),
      siteId: this.getSiteId(),
    };
  }

  /**
   * Removes the V2 enrollment and also removes the corresponding original SiteEnrollment
   * for backwards compatibility.
   *
   * @async
   * @returns {Promise<BaseModel>} - A promise that resolves to the current instance.
   * @throws {DataAccessError} - Throws an error if the schema does not allow removal
   * or if the removal operation fails.
   */
  async remove() {
    // Remove the original SiteEnrollment first for backwards compatibility
    const SiteEnrollmentCollection = this.entityRegistry.getCollection('SiteEnrollmentCollection');
    const siteId = this.getSiteId();
    const entitlementId = this.getEntitlementId();

    // Query by siteId and filter by entitlementId
    const enrollments = await SiteEnrollmentCollection.allBySiteId(siteId);
    const matchingEnrollment = enrollments.find(
      (e) => e.getEntitlementId() === entitlementId,
    );

    if (matchingEnrollment) {
      await SiteEnrollmentCollection.removeByIds([matchingEnrollment.getId()]);
      this.log.info(`Removed original SiteEnrollment for siteId: ${siteId}, entitlementId: ${entitlementId}`);
    } else {
      this.log.warn(`Original SiteEnrollment not found for siteId: ${siteId}, entitlementId: ${entitlementId}`);
    }

    try {
      // Remove the V2 enrollment after the original
      await super.remove();
    } catch (error) {
      this.log.error(`Failed to remove V2 SiteEnrollment: ${error.message}`, error);
      // We don't throw here to avoid breaking after original removal succeeded
    }

    return this;
  }
}

export default SiteEnrollmentV2;
