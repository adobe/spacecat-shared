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

import { validateAuditResult } from '../audit/audit.model.js';
import SchemaBuilder from '../base/schema.builder.js';
import LatestAudit from './latest-audit.model.js';
import LatestAuditCollection from './latest-audit.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(LatestAudit, LatestAuditCollection)
  .withPrimaryPartitionKeys(['siteId'])
  .withPrimarySortKeys(['auditType'])
  .addReference('belongs_to', 'Site', ['auditType'])
  .addReference('belongs_to', 'Audit', ['auditType'])
  .addReference('has_many', 'Opportunities')
  .addAllIndex(['auditType'])
  .allowUpdates(false)
  .allowRemove(false)
  .addAttribute('auditResult', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value),
    set: (value, attributes) => {
      // as the electroDb validate function does not provide access to the model instance
      // we need to call the validate function from the model on setting the value
      validateAuditResult(value, attributes.auditType);
      return value;
    },
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
    validate: (value) => isIsoDate(value),
  });

export default schema.build();
