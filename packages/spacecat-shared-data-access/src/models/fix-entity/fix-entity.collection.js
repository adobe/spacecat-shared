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
import ValidationError from '../../errors/validation.error.js';
import { guardId, guardArray, guardString } from '../../util/guards.js';
import { resolveUpdates } from '../../util/util.js';

/**
 * FixEntityCollection - A collection class responsible for managing FixEntities.
 * Extends the BaseCollection to provide specific methods for interacting with
 * FixEntity records and their relationships with Suggestions.
 *
 * This collection provides methods to:
 * - Retrieve suggestions associated with a specific FixEntity
 * - Set suggestions for a FixEntity by managing junction table relationships
 *
 * @class FixEntityCollection
 * @extends BaseCollection
 */
class FixEntityCollection extends BaseCollection {
  static COLLECTION_NAME = 'FixEntityCollection';

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

      if (fixEntitySuggestions.length === 0) {
        return [];
      }

      const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');
      const suggestions = await suggestionCollection
        .batchGetByKeys(fixEntitySuggestions
          .map((record) => ({ [suggestionCollection.idName]: record.getSuggestionId() })));
      return suggestions.data;
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
   * @param {string} opportunityId - The ID of the opportunity.
   * @param {FixEntity} fixEntity - The FixEntity entity.
   * @param {Array<Suggestion>} suggestions - An array of Suggestion entities.
   * @returns {Promise<{createdItems: Array, errorItems: Array, removedCount: number}>} - A promise
   *   that resolves to an object containing:
   *   - createdItems: Array of created FixEntitySuggestionCollection junction records
   *   - errorItems: Array of items that failed validation
   *   - removedCount: Number of existing relationships that were removed
   * @throws {DataAccessError} - Throws an error if the entities are not provided or if the
   *   operation fails.
   */
  async setSuggestionsForFixEntity(opportunityId, fixEntity, suggestions) {
    guardId('opportunityId', opportunityId, 'FixEntityCollection');
    guardArray('suggestions', suggestions, 'FixEntityCollection', 'any');

    // Simple null checks
    if (!fixEntity) {
      throw new ValidationError('fixEntity is required');
    }

    // Extract IDs and other values from entities
    const fixEntityId = fixEntity.getId();
    const fixEntityCreatedAt = fixEntity.getExecutedAt() || fixEntity.getCreatedAt();
    const suggestionIds = suggestions.map((suggestion) => suggestion.getId());

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
            opportunityId,
            fixEntityCreatedAt,
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

  /**
   * Gets all fixes with their suggestions for a specific opportunity and created date.
   * This method retrieves all fix entities and their associated suggestions for a given opportunity
   * and creation date.
   *
   * @async
   * @param {string} opportunityId - The ID of the opportunity.
   * @param {string} fixEntityCreatedDate - The creation date to filter by (YYYY-MM-DD format).
   * @returns {Promise<Array>} - A promise that resolves to an array of objects containing:
   *   - fixEntity: The FixEntity model
   *   - suggestions: Array of associated Suggestion models
   * @throws {DataAccessError} - Throws an error if the query fails.
   * @throws {ValidationError} - Throws an error if opportunityId or
   *   fixEntityCreatedDate is not provided.
   */
  async getAllFixesWithSuggestionByCreatedAt(opportunityId, fixEntityCreatedDate) {
    guardId('opportunityId', opportunityId, 'FixEntityCollection');
    guardString('fixEntityCreatedDate', fixEntityCreatedDate, 'FixEntityCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');
      const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');

      // Query fix entity suggestions by opportunity ID and created date
      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allByOpportunityIdAndFixEntityCreatedDate(opportunityId, fixEntityCreatedDate);

      if (fixEntitySuggestions.length === 0) {
        return [];
      }

      // Group suggestions by fix entity ID
      const suggestionsByFixEntityId = {};
      const fixEntityIds = new Set();

      for (const fixEntitySuggestion of fixEntitySuggestions) {
        const fixEntityId = fixEntitySuggestion.getFixEntityId();
        const suggestionId = fixEntitySuggestion.getSuggestionId();

        fixEntityIds.add(fixEntityId);

        if (!suggestionsByFixEntityId[fixEntityId]) {
          suggestionsByFixEntityId[fixEntityId] = [];
        }
        suggestionsByFixEntityId[fixEntityId].push(suggestionId);
      }

      // Get all fix entities
      const fixEntities = await this.batchGetByKeys(
        Array.from(fixEntityIds).map((id) => ({ [this.idName]: id })),
      );

      // Get all suggestions
      const allSuggestionIds = Object.values(suggestionsByFixEntityId).flat();
      const suggestions = await suggestionCollection.batchGetByKeys(
        allSuggestionIds.map((id) => ({ [suggestionCollection.idName]: id })),
      );

      // Create a map of suggestions by ID for quick lookup
      const suggestionsById = {};
      for (const suggestion of suggestions.data) {
        suggestionsById[suggestion.getId()] = suggestion;
      }

      // Combine fix entities with their suggestions
      const result = [];
      for (const fixEntity of fixEntities.data) {
        const fixEntityId = fixEntity.getId();
        const suggestionIds = suggestionsByFixEntityId[fixEntityId] || [];
        const suggestionsForFixEntity = suggestionIds
          .map((id) => suggestionsById[id])
          .filter(Boolean);

        result.push({
          fixEntity,
          suggestions: suggestionsForFixEntity,
        });
      }

      return result;
    } catch (error) {
      this.log.error('Failed to get all fixes with suggestions by created date', error);
      throw new DataAccessError('Failed to get all fixes with suggestions by created date', this, error);
    }
  }

  /**
   * Creates a FixEntity and updates associated Suggestions in a single atomic transaction.
   * This method uses ElectroDB's transact write to ensure all operations succeed or fail together.
   *
   * Use case: When creating a fix, you want to simultaneously:
   * 1. Create the FixEntity record
   * 2. Update the status of all related Suggestions (e.g., mark them as FIXED)
   * 3. Create FixEntitySuggestion junction records to link them
   *
   * @async
   * @param {Object} fixEntityData - The data for creating the FixEntity.
   * @param {string} fixEntityData.opportunityId - The ID of the opportunity.
   * @param {string} fixEntityData.type - The type of fix (from Suggestion.TYPES).
   * @param {Object} fixEntityData.changeDetails - Details of the changes made.
   * @param {string} [fixEntityData.executedBy] - Who executed the fix.
   * @param {string} [fixEntityData.executedAt] - When the fix was executed.
   * @param {string} [fixEntityData.publishedAt] - When the fix was published.
   * @param {string} [fixEntityData.status] - Status of the fix (defaults to PENDING).
   * @param {string} [fixEntityData.origin] - Origin of the fix (defaults to SPACECAT).
   * @param {Array<Object>} suggestionUpdates - Array of objects containing suggestion update info.
   * @param {string} suggestionUpdates[].suggestionId - The ID of the suggestion to update.
   * @param {string} suggestionUpdates[].opportunityId - The opportunity ID for the suggestion.
   * @param {string} [suggestionUpdates[].status] - The new status for the suggestion
   *   (defaults to 'FIXED').
   * @param {Object} [options] - Optional settings for the transaction.
   * @param {string} [options.token] - ClientRequestToken for idempotent operations
   *   (valid for 10 minutes).
   * @returns {Promise<Object>} - A promise that resolves to an object containing:
   *   - canceled: boolean indicating if the transaction was canceled
   *   - data: array of transaction item results
   *   - fixEntity: the created FixEntity (if successful)
   * @throws {DataAccessError} - Throws an error if validation fails or transaction fails.
   *
   * @example
   * const result = await fixEntityCollection.createFixEntityWithSuggestionUpdates(
   *   {
   *     opportunityId: 'opp-123',
   *     type: 'CODE_CHANGE',
   *     changeDetails: { file: 'index.js', lines: [10, 20] },
   *     executedBy: 'user-456',
   *     executedAt: '2024-01-15T10:00:00Z',
   *   },
   *   [
   *     { suggestionId: 'sugg-1', opportunityId: 'opp-123', status: 'FIXED' },
   *     { suggestionId: 'sugg-2', opportunityId: 'opp-123', status: 'FIXED' },
   *   ],
   *   { token: 'fix-opp-123-2024-01-15' }
   * );
   */
  async createFixEntityWithSuggestionUpdates(fixEntityData, suggestionUpdates = [], options = {}) {
    // Validate inputs
    if (!fixEntityData || typeof fixEntityData !== 'object') {
      throw new ValidationError('fixEntityData is required and must be an object');
    }

    guardId('opportunityId', fixEntityData.opportunityId, 'FixEntityCollection');
    guardArray('suggestionUpdates', suggestionUpdates, 'FixEntityCollection', 'any');

    if (suggestionUpdates.length === 0) {
      throw new ValidationError('At least one suggestion update is required');
    }

    // Validate each suggestion update
    for (const update of suggestionUpdates) {
      guardId('suggestionId', update.suggestionId, 'FixEntityCollection');
      guardId('opportunityId', update.opportunityId, 'FixEntityCollection');
    }

    try {
      // Pre-generate the fixEntityId so we can use it in the transaction
      const { fixEntityId } = fixEntityData;
      const fixEntityCreatedAt = fixEntityData.executedAt || new Date().toISOString();

      // Add the ID to the fix entity data
      const fixEntityDataWithId = {
        ...fixEntityData,
        fixEntityId,
      };

      // Perform the transaction with ALL operations atomically
      const transactionResult = await this.electroService.transaction
        .write(({ FixEntity, Suggestion, FixEntitySuggestion }) => {
          const mutations = [];

          // 1. Create the FixEntity with pre-generated ID
          mutations.push(
            FixEntity
              .create(fixEntityDataWithId)
              .commit({ response: 'all_old' }),
          );

          // 2. Update each Suggestion status
          for (const update of suggestionUpdates) {
            const { suggestionId, opportunityId, status = 'FIXED' } = update;

            mutations.push(
              Suggestion
                .patch({ suggestionId, opportunityId })
                .set({ status })
                .commit({ response: 'all_old' }),
            );
          }

          // 3. Create FixEntitySuggestion junction records IN THE SAME TRANSACTION
          // This ensures atomicity - if any operation fails, everything rolls back
          for (const update of suggestionUpdates) {
            mutations.push(
              FixEntitySuggestion
                .create({
                  opportunityId: update.opportunityId,
                  fixEntityCreatedAt,
                  fixEntityId,
                  suggestionId: update.suggestionId,
                })
                .commit({ response: 'all_old' }),
            );
          }

          return mutations;
        })
        .go(options.token ? { token: options.token } : {});

      // Check if transaction was canceled
      if (transactionResult.canceled) {
        const failedOperations = transactionResult.data
          .filter((item) => item.rejected)
          .map((item, index) => ({
            index,
            code: item.code,
            message: item.message,
          }));

        this.log.error('Transaction was canceled', { failedOperations });
        throw new DataAccessError(
          `Transaction canceled: ${failedOperations.map((op) => `${op.code} - ${op.message}`).join('; ')}`,
          this,
        );
      }

      // Fetch the created fix entity to return it
      let createdFixEntity = null;
      const fixEntityItem = transactionResult.data[0];

      if (!fixEntityItem.rejected) {
        // Fetch by the generated ID
        createdFixEntity = await this.findById(fixEntityId);
      }

      this.log.info(`Successfully created fix entity and updated ${suggestionUpdates.length} suggestions atomically`);

      return {
        canceled: transactionResult.canceled,
        data: transactionResult.data,
        fixEntity: createdFixEntity,
      };
    } catch (error) {
      this.log.error('Failed to create fix entity with suggestion updates', error);

      if (error instanceof DataAccessError || error instanceof ValidationError) {
        throw error;
      }

      throw new DataAccessError('Failed to create fix entity with suggestion updates', this, error);
    }
  }
}

export default FixEntityCollection;
