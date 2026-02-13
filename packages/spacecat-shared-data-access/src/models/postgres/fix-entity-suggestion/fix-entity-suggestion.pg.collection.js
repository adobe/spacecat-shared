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
import PostgresFixEntitySuggestionModel from './fix-entity-suggestion.pg.model.js';
import { guardId } from '../../../util/guards.js';

class PostgresFixEntitySuggestionCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'FixEntitySuggestionCollection';

  static MODEL_CLASS = PostgresFixEntitySuggestionModel;

  constructor(postgrestClient, entityRegistry, schema, log) {
    super(postgrestClient, entityRegistry, schema, log);

    // This is a join table with composite PK (suggestion_id, fix_entity_id) - no 'id' column.
    // createFieldMaps unconditionally maps idName -> 'id', so remove the phantom mapping.
    delete this.fieldMaps.toDbMap[this.idName];
    delete this.fieldMaps.toModelMap.id;
  }

  async allBySuggestionId(suggestionId, options = {}) {
    guardId('suggestionId', suggestionId, 'FixEntitySuggestionCollection');
    return this.allByIndexKeys({ suggestionId }, options);
  }
}

export default PostgresFixEntitySuggestionCollection;
