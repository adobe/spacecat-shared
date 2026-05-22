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

import { hasText, isValidUUID } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import BrandSemrushProject from './brand-semrush-project.model.js';
import BrandSemrushProjectCollection from './brand-semrush-project.collection.js';

// Mirrors the CHECK constraint on brand_to_semrush_projects.language
// (db/migrations/20260528000000_brand_to_semrush_projects.sql). The slice
// uniqueness gate is an exact DB string match, so inconsistent casing or
// format between callers would silently bypass the 409 and bill a duplicate
// Semrush project. Accepts BCP-47-shaped tags: 2/3-letter primary subtag
// (`en`, `de`, `zho`) optionally followed by a 2-4-letter region/script
// subtag (`de-ch`, `pt-br`, `zh-hant`). All lowercase by contract.
const LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(-[a-z]{2,4})?$/;

const schema = new SchemaBuilder(BrandSemrushProject, BrandSemrushProjectCollection)
  // brandId is the FK to the brands table in mysticat-data-service. We do
  // NOT model it as `.addReference('belongs_to', 'Brand')` here because
  // spacecat-shared-data-access does not (yet) ship a Brand entity — no
  // Brand model or collection is registered in entity.registry.js. With a
  // `belongs_to: Brand` reference in place, every BrandSemrushProject
  // instantiation throws "Collection BrandCollection not found" from
  // base.model.js's eager reference resolution (reference.js
  // #toAccessorConfigs), which 500s every spacecat-api-service /semrush/*
  // route in production.
  //
  // The attribute + addAllIndex pair below mirrors what `addReference(
  // 'belongs_to', 'Brand')` would have produced internally (see
  // schema.builder.js#addReference) — same UUID-validated `brandId`
  // attribute and same `allByBrandId` collection accessor that the semrush
  // handlers depend on (spacecat-api-service:
  // src/support/semrush/handlers/prompts.js). When/if a Brand entity is
  // added, this block can be replaced with `.addReference('belongs_to',
  // 'Brand')`, which additionally yields the navigation accessor
  // `getBrand()` on the model side.
  .addAttribute('brandId', {
    type: 'string',
    required: true,
    validate: (value) => isValidUUID(value),
  })
  .addAllIndex(['brandId'])
  .addAttribute('semrushProjectId', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  .addAttribute('semrushLocationId', {
    type: 'number',
    required: true,
    validate: (value) => Number.isInteger(value) && value > 0,
  })
  .addAttribute('language', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value) && LANGUAGE_TAG_REGEX.test(value),
  })
  .addAllIndex(['semrushProjectId']);

export default schema.build();
