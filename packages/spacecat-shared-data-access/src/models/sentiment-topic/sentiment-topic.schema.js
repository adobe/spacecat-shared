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
import SentimentTopic from './sentiment-topic.model.js';
import SentimentTopicCollection from './sentiment-topic.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/

Data Access Patterns:
1. Get all topics for a site: allBySiteId(siteId)
2. Get a specific topic: findById(siteId, topicId)
3. Get topics by audit type: allBySiteIdAndAuditType(siteId, auditType) - uses FilterExpression
4. Get enabled topics: allBySiteIdEnabled(siteId) - uses FilterExpression

Primary Key (Composite):
- Partition Key (PK): siteId
- Sort Key (SK): topicId
- Provides natural uniqueness for siteId + topicId combinations

No GSI needed - all queries are site-scoped with FilterExpression
*/

const schema = new SchemaBuilder(SentimentTopic, SentimentTopicCollection)
  .withPrimaryPartitionKeys(['siteId'])
  .withPrimarySortKeys(['topicId'])
  .addReference('belongs_to', 'Site')
  .addAttribute('topicId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('name', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('description', {
    type: 'string',
    required: false,
  })
  .addAttribute('topicName', {
    type: 'string',
    required: true,
  })
  .addAttribute('subPrompts', {
    type: 'list',
    items: { type: 'string' },
    required: true,
    default: [],
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
