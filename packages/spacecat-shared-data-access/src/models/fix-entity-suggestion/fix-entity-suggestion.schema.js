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

import SchemaBuilder from '../base/schema.builder.js';
import FixEntitySuggestion from './fix-entity-suggestion.model.js';
import FixEntitySuggestionCollection from './fix-entity-suggestion.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(FixEntitySuggestion, FixEntitySuggestionCollection)
  // Use composite primary key: suggestionId (PK) + fixEntityId (SK)
  .withPrimaryPartitionKeys(['suggestionId'])
  .withPrimarySortKeys(['fixEntityId'])
  // Manually add suggestionId attribute since we're not using belongs_to reference
  .addAttribute('suggestionId', {
    type: 'string',
    required: true,
  })
  // Reference to FixEntity (many-to-one relationship from junction table)
  // This creates GSI1 for querying by fixEntityId
  .addReference('belongs_to', 'FixEntity');

export default schema.build();
