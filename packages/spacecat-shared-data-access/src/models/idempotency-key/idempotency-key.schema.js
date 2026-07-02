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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import IdempotencyKey from './idempotency-key.model.js';
import IdempotencyKeyCollection from './idempotency-key.collection.js';

// idempotency_keys table has updated_at but no updated_by column.
const schema = new SchemaBuilder(IdempotencyKey, IdempotencyKeyCollection)
  .addAttribute('updatedBy', { type: 'string', required: false, postgrestIgnore: true })
  .addReference('belongs_to', 'Organization')
  .addAttribute('key', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('endpoint', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('status', {
    type: Object.values(IdempotencyKey.STATUSES),
    required: true,
    default: IdempotencyKey.STATUSES.PROCESSING,
  })
  .addAttribute('response', {
    type: 'any',
    required: false,
  })
  .addAttribute('expiresAt', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isIsoDate(value),
  });

export default schema.build();
