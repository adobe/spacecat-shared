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
 * PageCitabilityCollection - Manages PageCitability entities.
 *
 * @class PageCitabilityCollection
 * @extends BaseCollection
 */
class PageCitabilityCollection extends BaseCollection {
  static COLLECTION_NAME = 'PageCitabilityCollection';

  /**
   * Creates a PageCitability record, upserting on the globally-unique `url` column.
   *
   * The `url` column carries a global unique index (idx_page_citabilities_url_unique),
   * so upserting on `url` makes create idempotent and eliminates the concurrent
   * read-then-insert duplicate-key (Postgres 23505) race observed in production.
   *
   * @param {object} item - the PageCitability data to persist.
   * @returns {Promise<PageCitability>} the created (or updated) PageCitability instance.
   */
  async create(item) {
    return super.create(item, { upsert: true, onConflict: 'url' });
  }
}

export default PageCitabilityCollection;
