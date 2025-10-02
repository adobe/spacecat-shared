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

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';
import Suggestion from './suggestion.model.js';

/**
 * SuggestionCollection - A collection class responsible for managing Suggestion entities.
 * Extends the BaseCollection to provide specific methods for interacting with Suggestion records.
 *
 * @class SuggestionCollection
 * @extends BaseCollection
 */
class SuggestionCollection extends BaseCollection {
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

    this.log.info(`Bulk updated ${suggestions.length} suggestions to status: ${status}`);

    return suggestions;
  }

  /**
   * Gets all FixEntities associated with a specific Suggestion.
   *
   * @async
   * @param {string} suggestionId - The ID of the Suggestion.
   * @returns {Promise<{data: Array, unprocessed: Array<string>}>} - A promise that resolves to an
   *   object containing:
   *   - data: Array of found FixEntity models
   *   - unprocessed: Array of fix entity IDs that couldn't be processed
   * @throws {DataAccessError} - Throws an error if the suggestionId is not provided or if the
   *   query fails.
   */
  async getFixEntitiesBySuggestionId(suggestionId) {
    if (!suggestionId) {
      const message = 'Failed to get fix entities: suggestionId is required';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      // Get all junction records for this suggestion
      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allBySuggestionId(suggestionId);

      // Extract fix entity IDs from junction records
      const fixEntityIds = fixEntitySuggestions.map((record) => record.getFixEntityId());

      if (fixEntityIds.length === 0) {
        return { data: [], unprocessed: [] };
      }

      // Get the FixEntity collection from the entity registry
      const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');

      // Get all fix entities by their IDs using batch get
      return await fixEntityCollection.batchGetByIds(fixEntityIds).then((result) => ({
        data: result.data,
        unprocessed: result.unprocessed,
      }));
    } catch (error) {
      this.log.error('Failed to get fix entities for suggestion', error);
      throw new DataAccessError('Failed to get fix entities for suggestion', this, error);
    }
  }

  /**
   * Sets FixEntities for a specific Suggestion by replacing all existing fix entities with new
   * ones.
   * This method efficiently only removes relationships that are no longer needed and only adds
   * new ones.
   *
   * @async
   * @param {string} suggestionId - The ID of the Suggestion.
   * @param {Array<string|Object>} fixEntities - An array of fix entity IDs (strings) or fix entity
   *   model instances.
   * @returns {Promise<{createdItems: Array, errorItems: Array, removedCount: number}>} - A promise
   *   that resolves to an object containing:
   *   - createdItems: Array of created FixEntitySuggestion junction records
   *   - errorItems: Array of items that failed validation
   *   - removedCount: Number of existing relationships that were removed
   * @throws {DataAccessError} - Throws an error if the suggestionId is not provided or if the
   *   operation fails.
   */
  async setFixEntitiesBySuggestionId(suggestionId, fixEntities) {
    if (!suggestionId) {
      const message = 'Failed to set fix entities: suggestionId is required';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    if (!Array.isArray(fixEntities)) {
      const message = 'Fix entities must be an array';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      // Get current fix entity IDs
      const currentFixEntityIds = new Set();
      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allBySuggestionId(suggestionId);
      fixEntitySuggestions.forEach((rel) => currentFixEntityIds.add(rel.getFixEntityId()));

      // Get new fix entity IDs
      const newFixEntityIds = new Set();
      fixEntities.forEach((fixEntity) => {
        const fixEntityId = typeof fixEntity === 'string'
          ? fixEntity
          : fixEntity.getId();
        newFixEntityIds.add(fixEntityId);
      });

      // Find what to remove (existing but not in new)
      const toRemove = fixEntitySuggestions.filter(
        (rel) => !newFixEntityIds.has(rel.getFixEntityId()),
      );

      // Find what to add (new but not existing), removing duplicates
      const seenFixEntityIds = new Set();
      const toAdd = fixEntities.filter((fixEntity) => {
        const fixEntityId = typeof fixEntity === 'string'
          ? fixEntity
          : fixEntity.getId();

        // Skip if already seen (duplicate) or already exists
        if (seenFixEntityIds.has(fixEntityId) || currentFixEntityIds.has(fixEntityId)) {
          return false;
        }

        seenFixEntityIds.add(fixEntityId);
        return true;
      });

      let removedCount = 0;
      let createdItems = [];
      let errorItems = [];

      // Remove relationships that are no longer needed
      if (toRemove.length > 0) {
        const removeIds = toRemove.map((rel) => rel.getFixEntityId());
        await fixEntitySuggestionCollection.removeByIndexKeys(removeIds.map((id) => (
          {
            suggestionId,
            fixEntityId: id,
          })));
        removedCount = removeIds.length;
      }

      // Add new relationships
      if (toAdd.length > 0) {
        const junctionRecords = toAdd.map((fixEntity) => {
          const fixEntityId = typeof fixEntity === 'string'
            ? fixEntity
            : fixEntity.getId();

          return {
            suggestionId,
            fixEntityId,
          };
        });

        const addResult = await fixEntitySuggestionCollection.createMany(junctionRecords);
        createdItems = addResult.createdItems;
        errorItems = addResult.errorItems;
      }

      this.log.info(`Set fix entities for suggestion ${suggestionId}: removed ${removedCount}, `
        + `added ${createdItems.length}, failed ${errorItems.length}`);

      return { createdItems, errorItems, removedCount };
    } catch (error) {
      this.log.error('Failed to set fix entities for suggestion', error);
      throw new DataAccessError('Failed to set fix entities for suggestion', this, error);
    }
  }
}

export default SuggestionCollection;
