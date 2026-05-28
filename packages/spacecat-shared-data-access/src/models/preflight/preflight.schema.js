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
  isObject, isValidUrl, isIsoDate,
} from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import Preflight from './preflight.model.js';
import PreflightCollection from './preflight.collection.js';

const schema = new SchemaBuilder(Preflight, PreflightCollection)
  .addReference('belongs_to', 'Site', [], { required: true })
  .addReference('belongs_to', 'AsyncJob', [], { required: true })
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value) && value.length <= 2048,
  })
  .addAttribute('status', {
    type: Object.values(Preflight.Status),
    required: true,
    default: Preflight.Status.IN_PROGRESS,
  })
  // `createdBy` and `error` use type 'any' (matching neighbor `result`) because
  // ElectroDB's `map` type requires a `properties` schema for every sub-key,
  // and the validate function below already enforces the precise shape — a
  // duplicate `properties` declaration adds nothing. Declaring `type: 'map'`
  // here without `properties` was the original definition and throws
  // `InvalidAttributeDefinition` at Service construction, blocking any
  // downstream consumer that builds a v1 `new Service(EntityRegistry.getEntities())`
  // (e.g. spacecat-api-service `fixes.test.js`).
  .addAttribute('createdBy', {
    type: 'any',
    required: true,
    validate: (value) => isObject(value) && typeof value.email === 'string' && value.email.length > 0,
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
    type: 'any',
    validate: (value) => !value || (isObject(value) && typeof value.code === 'string' && value.code.length > 0 && typeof value.message === 'string' && value.message.length > 0),
  });

export default schema.build();
