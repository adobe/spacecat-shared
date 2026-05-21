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

import { hasText } from '@adobe/spacecat-shared-utils';

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
  // Reference to Brand (many-to-one). The owning organization and Semrush
  // workspace are reachable via Brand -> Organization.
  .addReference('belongs_to', 'Brand')
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
