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
 * SiteEnrollmentCollection - A class representing a collection of SiteEnrollment entities.
 * Provides methods to query and manipulate collections of SiteEnrollment data.
 *
 * @class SiteEnrollmentCollection
 * @extends BaseCollection
 */
class SiteEnrollmentCollection extends BaseCollection {
  static COLLECTION_NAME = 'SiteEnrollmentCollection';

  async create(item, options = {}) {
    if (item?.siteId && item?.entitlementId) {
      const existing = await this.allBySiteId(item.siteId);
      const match = existing.find(
        (enrollment) => enrollment.getEntitlementId() === item.entitlementId,
      );
      if (match) {
        return match;
      }
    }

    return super.create(item, options);
  }
}

export default SiteEnrollmentCollection;
