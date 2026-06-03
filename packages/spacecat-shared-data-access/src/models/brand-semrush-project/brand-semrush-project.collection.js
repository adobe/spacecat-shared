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

import BaseCollection from '../base/base.collection.js';

/**
 * BrandSemrushProjectCollection - collection of BrandSemrushProject rows.
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
   * @param {string} brandId
   * @param {number} geoTargetId Google Ads Geo Target ID.
   * @param {string} languageCode BCP-47 primary subtag.
   * @returns {Promise<BrandSemrushProject|null>}
   */
  async findBySlice(brandId, geoTargetId, languageCode) {
    return this.findByIndexKeys({ brandId, geoTargetId, languageCode });
  }
}

export default BrandSemrushProjectCollection;
