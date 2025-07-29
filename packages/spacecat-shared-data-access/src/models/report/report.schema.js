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

import { isNonEmptyObject, isString } from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import Report from './report.model.js';
import ReportCollection from './report.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(Report, ReportCollection)
  .addReference('belongs_to', 'Site')
  .addAllIndex(['reportType'])
  .addAttribute('reportType', {
    type: 'string',
    required: true,
    validate: (value) => isString(value) && value.length > 0,
  })
  .addAttribute('reportPeriod', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value)
    && isString(value.startDate) && isString(value.endDate),
  })
  .addAttribute('comparisonPeriod', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value)
    && isString(value.startDate) && isString(value.endDate),
  })
  .addAttribute('storagePath', {
    type: 'string',
    required: false,
    default: () => '',
    validate: (value) => !value || (isString(value) && value.length >= 0),
  })
  .addAttribute('status', {
    type: ['processing', 'success', 'failed'],
    required: true,
    default: 'processing',
  });

export default schema.build();
