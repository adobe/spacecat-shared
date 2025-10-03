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
import { guardId, guardArray } from '../../util/guards.js';
import { resolveUpdates } from '../../util/util.js';

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
   * Sets FixEntities for a specific Suggestion by replacing all existing fix entities with new
   * ones.
   * This method efficiently only removes relationships that are no longer needed and only adds
   * new ones.
   *
   * @async
   * @param {string} suggestionId - The ID of the Suggestion.
   * @param {Array<string>} fixEntityIds - An array of fix entity IDs (strings).
   * @returns {Promise<{createdItems: Array, errorItems: Array, removedCount: number}>} - A promise
   *   that resolves to an object containing:
   *   - createdItems: Array of created FixEntitySuggestion junction records
   *   - errorItems: Array of items that failed validation
   *   - removedCount: Number of existing relationships that were removed
   * @throws {DataAccessError} - Throws an error if the suggestionId is not provided or if the
   *   operation fails.
   */
  async setFixEntitiesBySuggestionId(suggestionId, fixEntityIds) {
    guardId('suggestionId', suggestionId, 'SuggestionCollection');
    guardArray('fixEntityIds', fixEntityIds, 'SuggestionCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      const existingRelationships = await fixEntitySuggestionCollection
        .allBySuggestionId(suggestionId);

      // Extract existing fix entity IDs from relationship objects
      const existingFixEntityIds = existingRelationships.map((rel) => rel.getFixEntityId());

      const { toDelete, toCreate } = resolveUpdates(existingFixEntityIds, fixEntityIds);

      let removePromise;
      let createPromise;
      const deleteKeys = toDelete.map((fixEntityId) => (
        {
          suggestionId,
          fixEntityId,
        }));
      const createKeys = toCreate.map((fixEntityId) => (
        {
          suggestionId,
          fixEntityId,
        }));

      if (toDelete.length > 0) {
        removePromise = fixEntitySuggestionCollection.removeByIndexKeys(deleteKeys);
      }

      if (toCreate.length > 0) {
        createPromise = fixEntitySuggestionCollection.createMany(createKeys);
      }

      const [removeResult, createResult] = await Promise.allSettled([removePromise, createPromise]);

      let removedCount = 0;
      let createdItems = [];
      let errorItems = [];
      if (removeResult.status === 'fulfilled') {
        removedCount = deleteKeys.length;
      } else {
        this.log.error('Remove operation failed:', removeResult.reason);
      }

      if (createResult.status === 'fulfilled') {
        createdItems = createResult.value?.createdItems || [];
        errorItems = createResult.value?.errorItems || [];
      } else {
        this.log.error('Create operation failed:', createResult.reason);
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
