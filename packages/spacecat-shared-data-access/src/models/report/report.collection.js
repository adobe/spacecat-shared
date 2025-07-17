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
 * ReportCollection — A collection class responsible for managing Report entities.
 * Extends the ReportCollection to provide specific methods for interacting with Report records.
 *
 * @class ReportCollection
 * @extends BaseCollection
 */
class ReportCollection extends BaseCollection {
  async create(item) {
    return super.create(item, { upsert: true });
  }
}

export default ReportCollection;
