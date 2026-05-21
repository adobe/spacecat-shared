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
import BrandToSemrushProject from './brand-to-semrush-project.model.js';
import BrandToSemrushProjectCollection from './brand-to-semrush-project.collection.js';

const schema = new SchemaBuilder(BrandToSemrushProject, BrandToSemrushProjectCollection)
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
    validate: (value) => hasText(value),
  })
  .addAllIndex(['semrushProjectId']);

export default schema.build();
