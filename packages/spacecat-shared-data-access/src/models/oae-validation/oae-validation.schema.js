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

import {
  hasText, isIsoDate, isObject, isValidUUID,
} from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import OaeValidation from './oae-validation.model.js';
import OaeValidationCollection from './oae-validation.collection.js';

const schema = new SchemaBuilder(OaeValidation, OaeValidationCollection)
  .addAttribute('jobId', {
    type: 'string',
    required: true,
    validate: (value) => isValidUUID(value),
  })
  .addReference('belongs_to', 'Suggestion')
  .addAttribute('status', {
    type: Object.values(OaeValidation.Status),
    required: true,
  })
  .addAttribute('type', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('outcome', {
    type: 'string',
    validate: (value) => !value || Object.values(OaeValidation.Outcome).includes(value),
  })
  .addAttribute('completedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('metadata', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addIndex(
    { composite: ['jobId'] },
    { composite: ['suggestionId'] },
  );

export default schema.build();
