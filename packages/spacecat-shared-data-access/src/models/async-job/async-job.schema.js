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
  isObject, isValidUrl, isIsoDate, isArray,
} from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import AsyncJob from './async-job.model.js';
import AsyncJobCollection from './async-job.collection.js';

const schema = new SchemaBuilder(AsyncJob, AsyncJobCollection)
  .withRecordExpiry(7)
  .addAttribute('status', {
    type: Object.values(AsyncJob.Status),
    required: true,
  })
  .addAttribute('resultLocation', {
    type: 'string',
    validate: (value) => !value || isValidUrl(value) || value.startsWith('s3://'),
  })
  .addAttribute('resultType', {
    type: 'string',
    validate: (value) => !value || Object.values(AsyncJob.ResultType).includes(value),
  })
  .addAttribute('result', {
    type: 'any',
    validate: (value) => !value || isObject(value) || isArray(value),
  })
  .addAttribute('error', {
    type: 'map',
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      details: { type: 'any' },
    },
    validate: (value) => !value || (isObject(value) && value.code && value.message),
  })
  .addAttribute('metadata', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('startedAt', {
    type: 'string',
    required: true,
    readOnly: true,
    default: () => new Date().toISOString(),
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('endedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addIndex(
    { composite: ['status'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
