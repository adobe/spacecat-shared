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
  isObject,
  isValidUUID,
} from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import DeploymentExperiment from './deployment-experiment.model.js';
import DeploymentExperimentCollection from './deployment-experiment.collection.js';

const schema = new SchemaBuilder(DeploymentExperiment, DeploymentExperimentCollection)
  .addReference('belongs_to', 'Site')
  .addReference('belongs_to', 'Opportunity')
  .addAttribute('preDeploymentId', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('postDeploymentId', {
    type: 'string',
    validate: (value) => !value || hasText(value),
  })
  .addAttribute('status', {
    type: Object.values(DeploymentExperiment.STATUSES),
    required: true,
    default: DeploymentExperiment.STATUSES.PRE_ANALYSIS_SUBMITTED,
  })
  .addAttribute('suggestionIds', {
    type: 'list',
    items: {
      type: 'string',
      required: true,
      validate: (value) => isValidUUID(value),
    },
    default: () => [],
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
    default: DeploymentExperiment.DEFAULT_UPDATED_BY,
    validate: (value) => hasText(value),
  })
  .addIndex(
    { composite: ['preDeploymentId'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
