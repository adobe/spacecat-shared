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

import BaseModel from '../base/base.model.js';

/**
 * TicketSuggestion — bridge record linking a Suggestion to the Ticket created for it.
 *
 * Enforces 1:1 in v1: `UNIQUE (suggestion_id)` at the DB level prevents the same
 * suggestion from being ticketed twice. In v2, the constraint relaxes to
 * `UNIQUE (suggestion_id, ticket_id)` to support grouped ticket creation (M:N).
 *
 * `suggestionId` is a logical reference (stored as TEXT), not a Postgres FK.
 * Suggestions live in DynamoDB/ElectroDB — there is no Postgres FK to enforce.
 * Application-layer validation ensures the suggestion exists before creating this record.
 *
 * `opportunityId` is stored for direct opportunity-scoped queries without requiring
 * a JOIN through the Ticket row.
 *
 * @class TicketSuggestion
 * @extends BaseModel
 */
class TicketSuggestion extends BaseModel {
  static ENTITY_NAME = 'TicketSuggestion';
}

export default TicketSuggestion;
