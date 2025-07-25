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

import { isInteger, isIsoDate, isValidUrl } from '@adobe/spacecat-shared-utils';

import { validate as uuidValidate } from 'uuid';

import SchemaBuilder from '../base/schema.builder.js';
import SiteTopForm from './site-top-form.model.js';
import SiteTopFormCollection from './site-top-form.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(SiteTopForm, SiteTopFormCollection)
  .addReference('belongs_to', 'Site', ['source', 'traffic'])
  .addAttribute('siteId', {
    type: 'string',
    required: true,
    validate: (value) => uuidValidate(value),
  })
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('formSource', {
    type: 'string',
    required: true,
  })
  .addAttribute('traffic', {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => isInteger(value),
  })
  .addAttribute('source', {
    type: 'string',
    required: true,
  })
  .addAttribute('importedAt', {
    type: 'string',
    required: true,
    default: () => new Date().toISOString(),
    validate: (value) => isIsoDate(value),
  })
  .addIndex(
    { composite: ['url', 'formSource'] },
    { composite: ['traffic'] },
  );

export default schema.build();
