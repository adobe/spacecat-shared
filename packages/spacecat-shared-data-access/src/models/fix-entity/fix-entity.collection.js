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
import { guardId, guardArray } from '../../util/guards.js';
import { resolveUpdates } from '../../util/util.js';

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
   * Gets all Suggestions associated with an array of FixEntitySuggestion junction records.
   * This is a helper method that takes junction records and retrieves the actual
   * suggestion entities.
   *
   * @async
   * @param {Array} fixEntitySuggestions - An array of FixEntitySuggestion junction records.
   * @returns {Promise<Array>} - A promise that resolves to an array of Suggestion models
   * @throws {DataAccessError} - Throws an error if the fixEntitySuggestions are not provided
   *   or if the query fails.
   */
  async getSuggestionsByFixEntitySuggestions(fixEntitySuggestions) {
    guardArray('fixEntitySuggestions', fixEntitySuggestions, 'FixEntityCollection', 'any');
    if (fixEntitySuggestions.length === 0) {
      return [];
    }

    try {
      const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');
      const suggestions = await suggestionCollection
        .batchGetByKeys(fixEntitySuggestions
          .map((record) => ({ [suggestionCollection.idName]: record.getSuggestionId() })));
      return suggestions.data;
    } catch (error) {
      this.log.error('Failed to get suggestions for fix entity suggestions', error);
      throw new DataAccessError('Failed to get suggestions for fix entity suggestions', this, error);
    }
  }

  /**
   * Gets all suggestions associated with a specific FixEntity.
   *
   * @async
   * @param {string} fixEntityId - The ID of the FixEntity.
   * @returns {Promise<Array>} - A promise that resolves to an array of Suggestion models
   * @throws {DataAccessError} - Throws an error if the fixEntityId is not provided or if the
   *   query fails.
   */
  async getSuggestionsByFixEntityId(fixEntityId) {
    guardId('fixEntityId', fixEntityId, 'FixEntityCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allByFixEntityId(fixEntityId);

      return this.getSuggestionsByFixEntitySuggestions(fixEntitySuggestions);
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
   * @param {Array<string>} suggestionIds - An array of suggestion IDs (strings).
   * @returns {Promise<{createdItems: Array, errorItems: Array, removedCount: number}>} - A promise
   *   that resolves to an object containing:
   *   - createdItems: Array of created FixEntitySuggestionCollection junction records
   *   - errorItems: Array of items that failed validation
   *   - removedCount: Number of existing relationships that were removed
   * @throws {DataAccessError} - Throws an error if the fixEntityId is not provided or if the
   *   operation fails.
   */
  async setSuggestionsByFixEntityId(fixEntityId, suggestionIds) {
    guardId('fixEntityId', fixEntityId, 'FixEntityCollection');
    guardArray('suggestionIds', suggestionIds, 'FixEntityCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      const existingRelationships = await fixEntitySuggestionCollection
        .allByFixEntityId(fixEntityId);

      // Extract existing suggestion IDs from relationship objects
      const existingSuggestionIds = existingRelationships.map((rel) => rel.getSuggestionId());

      const { toDelete, toCreate } = resolveUpdates(existingSuggestionIds, suggestionIds);

      let removePromise;
      let createPromise;

      if (toDelete.length > 0) {
        removePromise = fixEntitySuggestionCollection.removeByIndexKeys(
          toDelete.map((suggestionId) => (
            {
              suggestionId,
              fixEntityId,
            })),
        );
      }

      if (toCreate.length > 0) {
        createPromise = fixEntitySuggestionCollection.createMany(toCreate.map((suggestionId) => (
          {
            fixEntityId,
            suggestionId,
          })));
      }

      const [removeResult, createResult] = await Promise.allSettled([removePromise, createPromise]);

      let removedCount = 0;
      let createdItems = [];
      let errorItems = [];
      if (removeResult.status === 'fulfilled') {
        removedCount = toDelete.length;
      } else {
        this.log.error('Remove operation failed:', removeResult.reason);
      }

      if (createResult.status === 'fulfilled') {
        createdItems = createResult.value?.createdItems || [];
        errorItems = createResult.value?.errorItems || [];
      } else {
        this.log.error('Create operation failed:', createResult.reason);
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
