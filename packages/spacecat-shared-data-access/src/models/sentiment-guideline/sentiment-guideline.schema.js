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

/* c8 ignore start */

import { hasText } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import SentimentGuideline from './sentiment-guideline.model.js';
import SentimentGuidelineCollection from './sentiment-guideline.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/

Data Access Patterns:
1. Get all guidelines for a site: allBySiteId(siteId)
2. Get a specific guideline: findById(siteId, guidelineId)
3. Get enabled guidelines: allBySiteIdEnabled(siteId) - uses FilterExpression
4. Get guidelines by audit type: allBySiteIdAndAuditType(siteId, auditType) - uses FilterExpression
5. Get multiple guidelines by IDs: findByIds(siteId, guidelineIds)

Primary Key (Composite):
- Partition Key (PK): siteId
- Sort Key (SK): guidelineId
- Provides natural uniqueness for siteId + guidelineId combinations

No GSI needed - all queries are site-scoped with FilterExpression
*/

const schema = new SchemaBuilder(SentimentGuideline, SentimentGuidelineCollection)
  .withPrimaryPartitionKeys(['siteId'])
  .withPrimarySortKeys(['guidelineId'])
  .addReference('belongs_to', 'Site')
  .addAttribute('guidelineId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('name', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('instruction', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('audits', {
    type: 'set',
    items: 'string',
    required: true,
    default: [],
  })
  .addAttribute('enabled', {
    type: 'boolean',
    required: true,
    default: true,
  })
  .addAttribute('createdBy', {
    type: 'string',
    required: true,
    readOnly: true,
    default: 'system',
  });

export default schema.build();
