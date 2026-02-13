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
  .withPrimaryPartitionKeys(['suggestionId'])
  .withPrimarySortKeys(['fixEntityId'])
  // Join table: composite key (suggestion_id, fix_entity_id), no id/updated_by in Postgres
  .addAttribute('fixEntitySuggestionId', {
    type: 'string',
    required: true,
    readOnly: true,
    default: () => crypto.randomUUID(),
    postgrestField: false,
  })
  .addAttribute('updatedBy', {
    type: 'string',
    required: false,
    readOnly: false,
    watch: '*',
    default: () => 'system',
    postgrestField: false,
  })
  .addReference('belongs_to', 'FixEntity')
  .addReference('belongs_to', 'Suggestion')
  .addAttribute('opportunityId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('fixEntityCreatedAt', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('fixEntityCreatedDate', {
    type: 'string',
    readOnly: true,
    watch: ['fixEntityCreatedAt'],
    set: (_, { fixEntityCreatedAt }) => (fixEntityCreatedAt ? fixEntityCreatedAt.split('T')[0] : undefined),
    // Generated column in Postgres - computed from fix_entity_created_at
    postgrestField: false,
  })
  .addIndex(
    { composite: ['opportunityId'] },
    { composite: ['fixEntityCreatedDate', 'updatedAt'] },
  );

export default schema.build();
