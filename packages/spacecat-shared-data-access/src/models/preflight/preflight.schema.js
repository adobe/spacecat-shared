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

import {
  isObject, isValidUrl, isIsoDate, isValidUUID,
} from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import Preflight from './preflight.model.js';
import PreflightCollection from './preflight.collection.js';

const schema = new SchemaBuilder(Preflight, PreflightCollection)
  .withRecordExpiry(7)
  .addReference('belongs_to', 'Site', [], { required: true })
  .addAttribute('asyncJobId', {
    type: 'string',
    required: true,
    hidden: true,
    validate: (value) => isValidUUID(value),
  })
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('status', {
    type: Object.values(Preflight.Status),
    required: true,
    default: Preflight.Status.IN_PROGRESS,
  })
  .addAttribute('createdBy', {
    type: 'map',
    required: true,
    properties: {
      email: { type: 'string' },
      displayName: { type: 'string' },
    },
    validate: (value) => !value || (isObject(value) && !!value.email),
  })
  .addAttribute('startedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('endedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('result', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('error', {
    type: 'map',
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
    },
    validate: (value) => !value || (isObject(value) && value.code && value.message),
  });

export default schema.build();
