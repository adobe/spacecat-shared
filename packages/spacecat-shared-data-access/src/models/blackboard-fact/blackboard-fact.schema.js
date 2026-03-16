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
import BlackboardFact from './blackboard-fact.model.js';
import BlackboardFactCollection from './blackboard-fact.collection.js';

const schema = new SchemaBuilder(BlackboardFact, BlackboardFactCollection)
  .addAttribute('key', {
    type: 'string',
    required: true,
  })
  .addAttribute('value', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value),
  })
  .addAttribute('factType', {
    type: Object.values(BlackboardFact.FACT_TYPES),
    required: true,
  })
  .addAttribute('confidence', {
    type: 'number',
    required: true,
  })
  .addAttribute('source', {
    type: 'string',
    required: true,
  })
  .addAttribute('organizationId', {
    type: 'string',
    required: false,
  })
  .addAttribute('websiteId', {
    type: 'string',
    required: false,
  })
  .addAttribute('pageId', {
    type: 'string',
    required: false,
  })
  .addAttribute('isGlobal', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('eventTime', {
    type: 'string',
    required: false,
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('version', {
    type: 'number',
    required: true,
    default: 1,
  })
  .addAttribute('supersedesFactId', {
    type: 'string',
    required: false,
  })
  .addAttribute('derivedFromFacts', {
    type: 'any',
    required: false,
  })
  .addAttribute('derivedFromExternal', {
    type: 'any',
    required: false,
  })
  .addAttribute('isObsolete', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('obsoleteReason', {
    type: 'string',
    required: false,
  })
  .addAttribute('obsoletedAt', {
    type: 'string',
    required: false,
    validate: (value) => !value || isIsoDate(value),
  })
  .addAllIndex(['key'])
  .addAllIndex(['organizationId'])
  .addAllIndex(['websiteId']);

export default schema.build();
