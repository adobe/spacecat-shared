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

import FixEntity from './fix-entity.model.js';
import FixEntityCollection from './fix-entity.collection.js';

export {
  FixEntity,
  FixEntityCollection,
};

// Canonical FixEntity status transition table + predicate (SITES-47091).
export {
  FIX_ENTITY_TRANSITIONS,
  FIX_ENTITY_CREATE,
  isAllowedFixTransition,
} from './fix-entity.transitions.js';

// Canonical v2 changeDetails shape + validator (SITES-47997, ADR
// adobe/mysticat-architecture#200). The generic enum names live on
// FixEntity.CHANGE_DETAILS to keep them off the package-root barrel.
export {
  CHANGE_DETAILS_SCHEMA_VERSION,
  changeDetailsV2Schema,
  validateChangeDetails,
} from './change-details.schema.js';
