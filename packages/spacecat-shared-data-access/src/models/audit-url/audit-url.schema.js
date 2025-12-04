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

import { isValidUrl } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import AuditUrl from './audit-url.model.js';
import AuditUrlCollection from './audit-url.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/

Data Access Patterns:
1. Get all URLs for a site: allBySiteId(siteId)
2. Get all URLs for a site by byCustomer: filter in code after allBySiteId
3. Get a specific URL: findById(siteId, url) - uses composite primary key
4. Get URLs by audit type: filter in code after allBySiteId

Primary Key (Composite):
- Partition Key (PK): siteId
- Sort Key (SK): url
- This provides natural uniqueness for siteId + url combinations
- Similar pattern to LatestAudit (siteId + auditType)

No GSI needed - all queries go through the primary index via siteId.
*/

const schema = new SchemaBuilder(AuditUrl, AuditUrlCollection)
  .withPrimaryPartitionKeys(['siteId'])
  .withPrimarySortKeys(['url'])
  .addReference('belongs_to', 'Site')
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('byCustomer', {
    type: 'boolean',
    required: true,
    default: true,
  })
  .addAttribute('audits', {
    type: 'set',
    items: 'string',
    required: true,
    default: [],
  })
  .addAttribute('createdBy', {
    type: 'string',
    required: true,
    readOnly: true,
    default: 'system',
  });

export default schema.build();
