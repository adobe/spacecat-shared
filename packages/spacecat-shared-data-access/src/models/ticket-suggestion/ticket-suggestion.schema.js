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

/* c8 ignore start */

import SchemaBuilder from '../base/schema.builder.js';
import TicketSuggestion from './ticket-suggestion.model.js';
import TicketSuggestionCollection from './ticket-suggestion.collection.js';

// GSI on suggestionId powers findBySuggestionId() — used to check if a
// suggestion has already been ticketed before attempting to create a duplicate.
const schema = new SchemaBuilder(TicketSuggestion, TicketSuggestionCollection)
  // ticket_suggestions is append-only — the DB grants no UPDATE privilege (bridge rows are
  // immutable once created; delete and recreate if wrong). Disabling updates at the model
  // layer surfaces a clean ValidationError instead of an opaque PostgREST 403.
  .allowUpdates(false)
  // ticket_suggestions is append-only — no updated_at or updated_by columns in the DB.
  // Suppress the SchemaBuilder auto-added attributes so they are not included in INSERTs.
  .addAttribute('updatedAt', {
    type: 'string', required: false, readOnly: true, postgrestIgnore: true,
  })
  .addAttribute('updatedBy', { type: 'string', required: false, postgrestIgnore: true })
  .addReference('belongs_to', 'Ticket')
  .addAttribute('suggestionId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('opportunityId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('createdBy', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addIndex(
    { composite: ['suggestionId'] },
    { composite: [] },
  );

export default schema.build();
