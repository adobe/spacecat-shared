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

// SITES-47254: `startedAt`, `result`, and `error` live only on AsyncJob now —
// the underlying preflights table no longer carries them. Consumers fetch the
// joined AsyncJob (e.g., `await preflight.getAsyncJob()`) for lifecycle
// internals; `status` and `endedAt` remain here as a denormalized cache the
// projector keeps in sync.
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
  // `createdBy` uses type 'any' because ElectroDB's `map` type requires a
  // `properties` schema for every sub-key, and the validate function below
  // already enforces the precise shape — a duplicate `properties` declaration
  // adds nothing. Declaring `type: 'map'` here without `properties` was the
  // original definition and throws `InvalidAttributeDefinition` at Service
  // construction, blocking any downstream consumer that builds a v1
  // `new Service(EntityRegistry.getEntities())` (e.g. spacecat-api-service
  // `fixes.test.js`).
  .addAttribute('createdBy', {
    type: 'any',
    required: true,
    validate: (value) => isObject(value) && typeof value.email === 'string' && value.email.length > 0,
  })
  .addAttribute('endedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  });

export default schema.build();
