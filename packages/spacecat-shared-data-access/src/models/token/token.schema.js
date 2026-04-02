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

import { isValidUUID } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import Token from './token.model.js';
import TokenCollection from './token.collection.js';

/*
 * Token entity: per-site, per-tokenType (opportunity type), per-cycle token allocation.
 * Postgres table: tokens with primary key id, unique (site_id, token_type, cycle).
 * Data access: findBySiteIdAndTokenType(siteId, tokenType).
 * Consume: one token per grant_suggestions call (whole list of IDs)
 * via SuggestionGrantCollection.grantSuggestions().
 */

const schema = new SchemaBuilder(Token, TokenCollection)
  .addIndex({ composite: ['siteId', 'tokenType'] }, { composite: ['cycle'] })
  .addAttribute('siteId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUUID(value),
    postgrestField: 'site_id',
  })
  .addAttribute('tokenType', {
    type: 'string',
    required: true,
    postgrestField: 'token_type',
  })
  .addAttribute('cycle', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('total', {
    type: 'number',
    required: true,
    readOnly: true,
  })
  .addAttribute('used', {
    type: 'number',
    required: true,
    default: 0,
  });

export default schema.build();
