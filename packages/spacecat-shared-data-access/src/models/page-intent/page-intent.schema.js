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

import { isValidUrl } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import PageIntent from './page-intent.model.js';
import PageIntentCollection from './page-intent.collection.js';

/*
  Schema: https://electrodb.dev/en/modeling/schema/
  Attributes: https://electrodb.dev/en/modeling/attributes/
  Indexes: https://electrodb.dev/en/modeling/indexes/
*/

const schema = new SchemaBuilder(PageIntent, PageIntentCollection)
  // link back to Site entity
  .addReference('belongs_to', 'Site')

  // page’s full URL (must be unique)
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })

  // one of INFORMATIONAL, NAVIGATIONAL, TRANSACTIONAL, COMMERCIAL
  .addAttribute('pageIntent', {
    type: Object.values(PageIntent.PAGE_INTENTS),
    required: true,
  })

  // arbitrary topic string like “firefly” or “photoshop”
  .addAttribute('topic', {
    type: 'string',
    required: true,
  })

  // optionally track who last updated
  .addAttribute('updatedBy', {
    type: 'string',
    default: PageIntent.DEFAULT_UPDATED_BY,
  })

  // allow fetching the single record by its URL
  .addIndex(
    { composite: ['url'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
