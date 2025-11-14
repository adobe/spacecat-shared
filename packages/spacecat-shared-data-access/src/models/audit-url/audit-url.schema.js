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

import {
  isIsoDate,
  isValidUrl,
} from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import AuditUrl from './audit-url.model.js';
import AuditUrlCollection from './audit-url.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/

Data Access Patterns:
1. Get all URLs for a site: allBySiteId(siteId)
2. Get all URLs for a site by source: allBySiteIdAndSource(siteId, source)
3. Get a specific URL: allBySiteIdAndUrl(siteId, url)
4. Get URLs by audit type: allBySiteIdAndAuditType(siteId, auditType) - filtered in code

Indexes:
- Primary: siteId (PK) + url (SK) - for unique identification
- bySiteIdAndSource: siteId + source (GSI) - for querying by source
*/

const schema = new SchemaBuilder(AuditUrl, AuditUrlCollection)
  .addReference('belongs_to', 'Site', ['url'])
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('source', {
    type: 'string',
    required: true,
    default: AuditUrl.DEFAULT_SOURCE,
  })
  .addAttribute('audits', {
    type: 'list',
    items: {
      type: 'string',
    },
    required: true,
    default: [],
  })
  .addAttribute('rank', {
    type: 'number',
    required: false,
    default: null,
  })
  .addAttribute('traffic', {
    type: 'number',
    required: false,
    default: null,
  })
  .addAttribute('createdAt', {
    type: 'string',
    required: true,
    readOnly: true,
    default: () => new Date().toISOString(),
    validate: (value) => isIsoDate(value),
  })
  .addAttribute('updatedAt', {
    type: 'string',
    required: true,
    readOnly: true,
    watch: '*',
    default: () => new Date().toISOString(),
    set: () => new Date().toISOString(),
    validate: (value) => isIsoDate(value),
  })
  .addAttribute('createdBy', {
    type: 'string',
    required: true,
    readOnly: true,
    default: 'system',
  })
  .addAttribute('updatedBy', {
    type: 'string',
    required: true,
    watch: '*',
    default: 'system',
    set: (value) => value,
  })
  // Add a second GSI for querying by siteId and source
  .addIndex(
    { composite: ['siteId'] },
    { composite: ['source'] },
  );

export default schema.build();
