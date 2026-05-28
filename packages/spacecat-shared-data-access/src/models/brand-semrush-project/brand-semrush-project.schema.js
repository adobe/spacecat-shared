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

// "upstream" in the comments below refers to Semrush AIO — the entity name,
// table name, and `semrushProjectId` accessor stay because the value IS the
// upstream identifier. The public API surface decouples via the LLMO-5190
// rename plan (see the schema attributes' `postgrestField` overrides).

// Mirrors the CHECK constraint on brand_to_semrush_projects.language
// (db/migrations/20260528000000_brand_to_semrush_projects.sql). The slice
// uniqueness gate is an exact DB string match, so inconsistent casing or
// format between callers would silently bypass the 409 and bill a duplicate
// upstream project. Accepts BCP-47-shaped tags: 2/3-letter primary subtag
// (`en`, `de`, `zho`) optionally followed by a 2-4-letter region/script
// subtag (`de-ch`, `pt-br`, `zh-hant`). All lowercase by contract.
const LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(-[a-z]{2,4})?$/;

const schema = new SchemaBuilder(BrandSemrushProject, BrandSemrushProjectCollection)
  // brandId is the FK to the brands table in mysticat-data-service. Declared
  // explicitly (rather than via `.addReference('belongs_to', 'Brand')`)
  // because this package does not ship a Brand entity — `belongs_to` would
  // throw "Collection BrandCollection not found" at model instantiation
  // (reference.js#toAccessorConfigs). The (brandId, updatedAt) index below
  // produces the same `allByBrandId` accessor `belongs_to` would have.
  // Swap back to `.addReference('belongs_to', 'Brand')` once Brand is
  // registered.
  .addAttribute('brandId', {
    type: 'string',
    required: true,
    validate: (value) => isValidUUID(value),
  })
  .addIndex({ composite: ['brandId'] }, { composite: ['updatedAt'] })
  .addAttribute('semrushProjectId', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value),
  })
  // Google Ads Geo Target ID (criterion_id for the country). Semrush re-uses
  // it as their location identifier; the value is owned by Google Ads, not
  // Semrush. DB column stays `semrush_location_id` — the table layout is
  // subject to change independently (see LLMO-5190 plan §Context).
  .addAttribute('geoTargetId', {
    type: 'number',
    required: true,
    validate: (value) => Number.isInteger(value) && value > 0,
    postgrestField: 'semrush_location_id',
  })
  // BCP-47 primary subtag (`en`, `de`, `fr`), optionally with a region/script
  // subtag (`de-ch`, `pt-br`, `zh-hant`). DB column stays `language`.
  .addAttribute('languageCode', {
    type: 'string',
    required: true,
    validate: (value) => hasText(value) && LANGUAGE_TAG_REGEX.test(value),
    postgrestField: 'language',
  })
  .addAllIndex(['semrushProjectId']);

export default schema.build();
