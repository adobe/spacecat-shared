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
import SuggestionGrant from './suggestion-grant.model.js';
import SuggestionGrantCollection from './suggestion-grant.collection.js';

/*
 * SuggestionGrant: suggestion_grants table (insert-only via grant_suggestions RPC).
 * Columns: id, grant_id, suggestion_id, site_id, token_id, token_type, created_at, granted_at.
 * Table has no updated_at/updated_by; those defaults are ignored for PostgREST.
 */

const schema = new SchemaBuilder(SuggestionGrant, SuggestionGrantCollection)
  .addAttribute('updatedAt', {
    type: 'string', required: true, readOnly: true, postgrestIgnore: true,
  })
  .addAttribute('updatedBy', {
    type: 'string', required: false, postgrestIgnore: true,
  })
  .addIndex({ composite: ['suggestionId'] }, { composite: [] })
  .addAttribute('suggestionId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUUID(value),
    postgrestField: 'suggestion_id',
  })
  .addAttribute('grantId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUUID(value),
    postgrestField: 'grant_id',
  })
  .addAttribute('siteId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUUID(value),
    postgrestField: 'site_id',
  })
  .addAttribute('tokenId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUUID(value),
    postgrestField: 'token_id',
  })
  .addAttribute('tokenType', {
    type: 'string',
    required: true,
    readOnly: true,
    postgrestField: 'token_type',
  })
  .addAttribute('grantedAt', {
    type: 'string',
    required: true,
    readOnly: true,
    postgrestField: 'granted_at',
  });

export default schema.build();
