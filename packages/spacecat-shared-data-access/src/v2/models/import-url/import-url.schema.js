/*
 * Copyright 2024 Adobe. All rights reserved.
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

import { isIsoDate, isValidUrl } from '@adobe/spacecat-shared-utils';

import { ImportUrlStatus } from '../import-job/import-job.model.js';
import SchemaBuilder from '../base/schema.builder.js';
import ImportUrl, { IMPORT_URL_EXPIRES_IN_DAYS } from './import-url.model.js';
import ImportUrlCollection from './import-url.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(ImportUrl, ImportUrlCollection)
  .addReference('belongs_to', 'ImportJob', ['status'])
  .addAttribute('expiresAt', {
    type: 'string',
    required: true,
    validate: (value) => isIsoDate(value),
    default: () => {
      const date = new Date();
      date.setDate(date.getDate() + IMPORT_URL_EXPIRES_IN_DAYS);
      return date.toISOString();
    },
  })
  .addAttribute('file', {
    type: 'string',
  })
  .addAttribute('path', {
    type: 'string',
  })
  .addAttribute('reason', {
    type: 'string',
  })
  .addAttribute('status', {
    type: Object.values(ImportUrlStatus),
    required: true,
  })
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  });

export default schema.build();
