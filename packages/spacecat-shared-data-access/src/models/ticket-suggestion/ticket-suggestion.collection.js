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

import { DataAccessError } from '../../errors/index.js';
import BaseCollection from '../base/base.collection.js';

/**
 * TicketSuggestionCollection — manages TicketSuggestion bridge records.
 *
 * Auto-generated query methods (via schema references and indexes):
 *   allByTicketId(ticketId)               — all suggestions linked to a ticket
 *   findBySuggestionId(suggestionId)      — look up whether a suggestion has been ticketed
 *
 * @class TicketSuggestionCollection
 * @extends BaseCollection
 */
class TicketSuggestionCollection extends BaseCollection {
  static COLLECTION_NAME = 'TicketSuggestionCollection';

  /**
   * Returns all bridge records whose suggestion_id is in the given array.
   * Used for bulk pre-flight checks before ticket creation.
   *
   * @param {string[]} suggestionIds
   * @returns {Promise<import('./ticket-suggestion.model.js').default[]>}
   */
  async allBySuggestionIds(suggestionIds) {
    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .select()
      .in('suggestion_id', suggestionIds);

    if (error) {
      throw new DataAccessError('Failed to load ticket suggestions by suggestion IDs', { entityName: 'TicketSuggestion' }, error);
    }

    return (data ?? []).map((row) => this.createInstanceFromRow(row));
  }

  /**
   * Returns all bridge records whose ticket_id is in the given array.
   * Used to bulk-load suggestion mappings when listing tickets.
   *
   * @param {string[]} ticketIds
   * @returns {Promise<import('./ticket-suggestion.model.js').default[]>}
   */
  async allByTicketIds(ticketIds) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return [];
    }

    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .select()
      .in('ticket_id', ticketIds);

    if (error) {
      throw new DataAccessError('Failed to load ticket suggestions by ticket IDs', { entityName: 'TicketSuggestion' }, error);
    }

    return (data ?? []).map((row) => this.createInstanceFromRow(row));
  }
}

export default TicketSuggestionCollection;
