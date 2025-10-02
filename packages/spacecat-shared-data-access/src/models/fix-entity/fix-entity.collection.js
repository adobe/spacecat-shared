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
import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';

/**
 * FixEntityCollection - A collection class responsible for managing FixEntities.
 * Extends the BaseCollection to provide specific methods for interacting with
 * FixEntity records.
 *
 * @class FixEntityCollection
 * @extends BaseCollection
 */
class FixEntityCollection extends BaseCollection {
  /**
   * Gets all suggestions associated with a specific FixEntity.
   *
   * @async
   * @param {string} fixEntityId - The ID of the FixEntity.
   * @returns {Promise<{data: Array, unprocessed: Array<string>}>} - A promise that resolves to an
   *   object containing:
   *   - data: Array of found Suggestion models
   *   - unprocessed: Array of suggestion IDs that couldn't be processed
   * @throws {DataAccessError} - Throws an error if the fixEntityId is not provided or if the
   *   query fails.
   */
  async getSuggestionsByFixEntityId(fixEntityId) {
    if (!fixEntityId) {
      const message = 'Failed to get suggestions: fixEntityId is required';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestion');

      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allByFixEntityId(fixEntityId);

      const suggestionIds = fixEntitySuggestions.map((record) => record.getSuggestionId());

      if (suggestionIds.length === 0) {
        return { data: [], unprocessed: [] };
      }

      const suggestionCollection = this.entityRegistry.getCollection('Suggestion');

      return await suggestionCollection.batchGetByIds(suggestionIds).then((result) => ({
        data: result.data,
        unprocessed: result.unprocessed,
      }));
    } catch (error) {
      this.log.error(`Failed to get suggestions for fix entity: ${fixEntityId}`, error);
      throw new DataAccessError('Failed to get suggestions for fix entity', this, error);
    }
  }

  /**
   * Sets suggestions for a specific FixEntity by replacing all existing suggestions with new ones.
   * This method efficiently only removes relationships that are no longer needed and only adds
   * new ones.
   *
   * @async
   * @param {string} fixEntityId - The ID of the FixEntity.
   * @param {Array<string|Object>} suggestions - An array of suggestion IDs (strings) or suggestion
   *   model instances.
   * @returns {Promise<{createdItems: Array, errorItems: Array, removedCount: number}>} - A promise
   *   that resolves to an object containing:
   *   - createdItems: Array of created FixEntitySuggestion junction records
   *   - errorItems: Array of items that failed validation
   *   - removedCount: Number of existing relationships that were removed
   * @throws {DataAccessError} - Throws an error if the fixEntityId is not provided or if the
   *   operation fails.
   */
  async setSuggestionsByFixEntityId(fixEntityId, suggestions) {
    if (!fixEntityId) {
      const message = 'Failed to set suggestions: fixEntityId is required';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    if (!Array.isArray(suggestions)) {
      const message = 'Suggestions must be an array';
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestion');

      // Get current suggestion IDs
      const currentSuggestionIds = new Set();
      const existingRelationships = await fixEntitySuggestionCollection
        .allByFixEntityId(fixEntityId);
      existingRelationships.forEach((rel) => currentSuggestionIds.add(rel.getSuggestionId()));

      // Get new suggestion IDs
      const newSuggestionIds = new Set();
      suggestions.forEach((suggestion) => {
        const suggestionId = typeof suggestion === 'string'
          ? suggestion
          : suggestion.getId();
        newSuggestionIds.add(suggestionId);
      });

      // Find what to remove (existing but not in new)
      const toRemove = existingRelationships.filter(
        (rel) => !newSuggestionIds.has(rel.getSuggestionId()),
      );

      // Find what to add (new but not existing)
      const toAdd = suggestions.filter((suggestion) => {
        const suggestionId = typeof suggestion === 'string'
          ? suggestion
          : suggestion.getId();
        return !currentSuggestionIds.has(suggestionId);
      });

      let removedCount = 0;
      let createdItems = [];
      let errorItems = [];

      // Remove relationships that are no longer needed
      if (toRemove.length > 0) {
        const removeIds = toRemove.map((rel) => rel.getId());
        await fixEntitySuggestionCollection.removeByIds(removeIds);
        removedCount = removeIds.length;
      }

      // Add new relationships
      if (toAdd.length > 0) {
        const junctionRecords = toAdd.map((suggestion) => {
          const suggestionId = typeof suggestion === 'string'
            ? suggestion
            : suggestion.getId();

          return {
            fixEntityId,
            suggestionId,
          };
        });

        const addResult = await fixEntitySuggestionCollection.createMany(junctionRecords);
        createdItems = addResult.createdItems;
        errorItems = addResult.errorItems;
      }

      this.log.info(`Set suggestions for fix entity ${fixEntityId}: removed ${removedCount}, `
        + `added ${createdItems.length}, failed ${errorItems.length}`);

      return { createdItems, errorItems, removedCount };
    } catch (error) {
      this.log.error('Failed to set suggestions for fix entity', error);
      throw new DataAccessError('Failed to set suggestions for fix entity', this, error);
    }
  }
}

export default FixEntityCollection;
