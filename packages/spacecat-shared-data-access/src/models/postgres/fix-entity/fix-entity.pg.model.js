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

import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresFixEntityModel extends PostgresBaseModel {
  static ENTITY_NAME = 'FixEntity';

  static DEFAULT_UPDATED_BY = 'spacecat';

  static STATUSES = {
    PENDING: 'PENDING',
    DEPLOYED: 'DEPLOYED',
    PUBLISHED: 'PUBLISHED',
    FAILED: 'FAILED',
    ROLLED_BACK: 'ROLLED_BACK',
  };

  static ORIGINS = {
    SPACECAT: 'spacecat',
    ASO: 'aso',
    REPORTING: 'reporting',
  };

  async getSuggestions() {
    const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');
    return fixEntityCollection
      .getSuggestionsByFixEntityId(this.getId());
  }
}

export default PostgresFixEntityModel;
