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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';
import Suggestion from './suggestion.model.js';
import { guardId } from '../../util/guards.js';

/**
 * SuggestionCollection - A collection class responsible for managing Suggestion entities.
 * Extends the BaseCollection to provide specific methods for interacting with Suggestion records
 * and their relationships with FixEntities.
 *
 * This collection provides methods to:
 * - Update the status of multiple suggestions in bulk
 * - Retrieve FixEntities associated with a specific Suggestion
 *
 * @class SuggestionCollection
 * @extends BaseCollection
 */
class SuggestionCollection extends BaseCollection {
  static COLLECTION_NAME = 'SuggestionCollection';

  /**
   * Updates the status of multiple given suggestions. The given status must conform
   * to the status enum defined in the Suggestion schema.
   * Saves the updated suggestions to the database automatically.
   * You don't need to call save() on the suggestions after calling this method.
   * @async
   * @param {Suggestion[]} suggestions - An array of Suggestion instances to update.
   * @param {string} status - The new status to set for the suggestions.
   * @return {Promise<*>} - A promise that resolves to the updated suggestions.
   * @throws {Error} - Throws an error if the suggestions are not provided
   * or if the status is invalid.
   */
  async bulkUpdateStatus(suggestions, status) {
    if (!Array.isArray(suggestions)) {
      throw new Error('Suggestions must be an array');
    }

    if (!Object.values(Suggestion.STATUSES).includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${Object.values(Suggestion.STATUSES).join(', ')}`);
    }

    suggestions.forEach((suggestion) => {
      suggestion.setStatus(status);
    });

    await this._saveMany(suggestions);

    return suggestions;
  }

  /**
   * Gets all FixEntities associated with a specific Suggestion.
   *
   * @async
   * @param {string} suggestionId - The ID of the Suggestion.
   * @returns {Promise<Array>} - A promise that resolves to an array of FixEntity models
   * @throws {DataAccessError} - Throws an error if the suggestionId is not provided or if the
   *   query fails.
   */
  async getFixEntitiesBySuggestionId(suggestionId) {
    guardId('suggestionId', suggestionId, 'SuggestionCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');
      const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');

      // Get all junction records for this suggestion
      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allBySuggestionId(suggestionId);

      if (fixEntitySuggestions.length === 0) {
        return [];
      }

      const fixEntityIds = fixEntitySuggestions.map((record) => record.getFixEntityId());
      const result = await fixEntityCollection
        .batchGetByKeys(fixEntityIds.map((id) => ({ [fixEntityCollection.idName]: id })));
      return result.data;
    } catch (error) {
      this.log.error('Failed to get fix entities for suggestion', error);
      throw new DataAccessError('Failed to get fix entities for suggestion', this, error);
    }
  }

  /**
   * Grants one or more suggestions by consuming a single token for the given token type.
   * Resolves the current cycle token via TokenCollection#findBySiteIdAndTokenType
   * (which auto-creates if missing), checks that at least one token remains, then calls the
   * grant_suggestions RPC to atomically consume one token and insert suggestion grants for
   * the entire list of IDs.
   *
   * @async
   * @param {string[]} suggestionIds - Suggestion IDs to grant (one token consumed for the list).
   * @param {string} siteId - The site ID that owns the token allocation.
   * @param {string} tokenType - Token type (e.g. 'monthly_suggestion_cwv').
   * @returns {Promise<{ success: boolean, reason?: string, grantedSuggestions?: Array }>}
   * @throws {DataAccessError} - On missing inputs or RPC failure.
   */
  async grantSuggestions(suggestionIds, siteId, tokenType) {
    if (!Array.isArray(suggestionIds) || suggestionIds.some((id) => !hasText(id))) {
      throw new DataAccessError('grantSuggestions: suggestionIds must be an array of non-empty strings', this);
    }
    if (!hasText(siteId)) {
      throw new DataAccessError('grantSuggestions: siteId is required', this);
    }
    if (!hasText(tokenType)) {
      throw new DataAccessError('grantSuggestions: tokenType is required', this);
    }

    const tokenCollection = this.entityRegistry.getCollection('TokenCollection');
    const token = await tokenCollection.findBySiteIdAndTokenType(siteId, tokenType, false);

    if (!token || token.getRemaining() < 1) {
      return { success: false, reason: 'no_tokens' };
    }

    const cycle = token.getCycle();

    const { data, error } = await this.postgrestService.rpc('grant_suggestions', {
      p_suggestion_ids: suggestionIds,
      p_site_id: siteId,
      p_token_type: tokenType,
      p_cycle: cycle,
    });

    if (error) {
      this.log.error('grantSuggestions: RPC failed', error);
      throw new DataAccessError('Failed to grant suggestions (grant_suggestions)', this, error);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || !row.success) {
      return { success: false, reason: row?.reason || 'rpc_no_result' };
    }

    return { success: true, grantedSuggestions: row.granted_suggestions };
  }
}

export default SuggestionCollection;
