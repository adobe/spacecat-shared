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

import { isIsoDate, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import FixEntity from './fix-entity.model.js';
import FixEntityCollection from './fix-entity.collection.js';
import { Suggestion } from '../suggestion/index.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(FixEntity, FixEntityCollection)
  .addReference('has_many', 'FixEntitySuggestion')
  .addReference('belongs_to', 'Opportunity', ['status'])
  .addAttribute('type', {
    type: Object.values(Suggestion.TYPES),
    required: true,
    readOnly: true,
  })
  .addAttribute('executedBy', {
    type: 'string',
  })
  .addAttribute('executedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('publishedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('changeDetails', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value),
  })
  .addAttribute('status', {
    type: Object.values(FixEntity.STATUSES),
    required: true,
    default: FixEntity.STATUSES.PENDING,
  });

export default schema.build();
