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

import {
  hasText,
  isInteger,
  isObject,
  isValidUUID,
} from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import GeoExperiment from './geo-experiment.model.js';
import GeoExperimentCollection from './geo-experiment.collection.js';

const schema = new SchemaBuilder(GeoExperiment, GeoExperimentCollection)
  .addReference('belongs_to', 'Site')
  .addReference('belongs_to', 'Opportunity', [], { required: false })
  .addAttribute('preScheduleId', {
    type: 'string',
    validate: (value) => !value || hasText(value),
  })
  .addAttribute('postScheduleId', {
    type: 'string',
    validate: (value) => !value || hasText(value),
  })
  .addAttribute('status', {
    type: Object.values(GeoExperiment.STATUSES),
    required: true,
    default: GeoExperiment.STATUSES.PRE_ANALYSIS_SUBMITTED,
  })
  .addAttribute('skipDeploy', {
    type: 'boolean',
    default: false,
  })
  .addAttribute('suggestionIds', {
    type: 'list',
    items: {
      type: 'string',
      validate: (value) => isValidUUID(value),
    },
    default: () => [],
  })
  .addAttribute('name', {
    type: 'string',
    validate: (value) => !value || hasText(value),
  })
  .addAttribute('promptsCount', {
    type: 'number',
    default: 0,
    validate: (value) => isInteger(value) && value >= 0,
  })
  .addAttribute('promptsS3Key', {
    type: 'string',
    validate: (value) => !value || hasText(value),
  })
  .addAttribute('metadata', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('error', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('updatedBy', {
    type: 'string',
    default: GeoExperiment.DEFAULT_UPDATED_BY,
    validate: (value) => hasText(value),
  })
  .addIndex(
    { composite: ['preScheduleId'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
