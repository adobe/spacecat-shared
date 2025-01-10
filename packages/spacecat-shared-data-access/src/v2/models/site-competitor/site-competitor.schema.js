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

/* c8 ignore start */
import { isValidUrl } from '@adobe/spacecat-shared-utils';

import { validate as uuidValidate } from 'uuid';

import SchemaBuilder from '../base/schema.builder.js';
import SiteCompetitor from './site-competitor.model.js';
import SiteCompetitorCollection from './site-competitor.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(SiteCompetitor, SiteCompetitorCollection)
  .addReference('belongs_to', 'Site')
  .addAttribute('siteId', {
    type: 'string',
    validate: (value) => !value || uuidValidate(value),
  })
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('updatedBy', {
    type: 'string',
  })
  .addAllIndex(['baseURL'])
  .addIndex(
    { composite: ['siteId'] },
    { composite: ['updatedAt'] },
  );

/* c8 ignore stop */

export default schema.build();
