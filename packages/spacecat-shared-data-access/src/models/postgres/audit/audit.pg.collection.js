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

import PostgresBaseCollection from '../base/postgres-base.collection.js';
import PostgresAuditModel from './audit.pg.model.js';

/**
 * PostgresAuditCollection - A Postgres-backed collection for Audit entities.
 * Audits are immutable (no updates or removes, enforced by schema).
 * In v3, LatestAudit is derived from Audit queries, so _onCreate and _onCreateMany are no-ops.
 *
 * @class PostgresAuditCollection
 * @extends PostgresBaseCollection
 */
class PostgresAuditCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'AuditCollection';

  static MODEL_CLASS = PostgresAuditModel;

  // LatestAudit is derived from audits in v3; no copy table writes.
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreate(item) {
    // no-op
  }

  // LatestAudit is derived from audits in v3; no copy table writes.
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreateMany(items) {
    // no-op
  }
}

export default PostgresAuditCollection;
