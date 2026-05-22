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
 * PreflightCollection - A collection class responsible for managing Preflight entities.
 * Extends the BaseCollection to provide specific methods for interacting with Preflight records.
 *
 * allBySiteId(siteId) is auto-generated from the BELONGS_TO Site reference in the schema.
 *
 * @class PreflightCollection
 * @extends BaseCollection
 */
class PreflightCollection extends BaseCollection {
  static COLLECTION_NAME = 'PreflightCollection';

  /**
   * Returns all preflights for a site, optionally filtered by URL.
   * URL filtering is applied in-memory; the 7-day TTL bounds per-site volume to a manageable
   * size, making a composite (site_id, url) index unnecessary at this stage.
   *
   * @param {string} siteId - The site ID to query.
   * @param {string} [url] - Optional URL to filter by.
   * @returns {Promise<Preflight[]>}
   */
  async allBySiteIdAndUrl(siteId, url) {
    const all = await this.allBySiteId(siteId);
    if (!url) {
      return all;
    }
    return all.filter((p) => p.getUrl() === url);
  }
}

export default PreflightCollection;
