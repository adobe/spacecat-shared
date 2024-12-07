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

import { isIsoDate, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder('Audit', 1, 'SpaceCat')
  .addReference('belongs_to', 'Site', ['auditType', 'auditedAt'])
  .addReference('has_many', 'Opportunities')
  .addAttribute('auditResult', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value),
  })
  .addAttribute('auditType', {
    type: 'string',
    required: true,
  })
  .addAttribute('fullAuditRef', {
    type: 'string',
    required: true,
  })
  .addAttribute('isLive', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('isError', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('auditedAt', {
    type: 'string',
    required: true,
    default: () => new Date().toISOString(),
    validate: (value) => isIsoDate(value),
  });

export default schema.build();
