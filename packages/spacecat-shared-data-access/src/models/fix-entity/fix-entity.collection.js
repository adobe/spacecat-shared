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
   * Updates a FixEntity and its linked Suggestions atomically.
   * Uses a single RPC (rpc_update_fix_and_suggestions_status) so all updates
   * succeed or fail together in one database transaction.
   *
   * This method:
   * 1. Validates that the fix entity has at least one suggestion
   * 2. Calls the database RPC to set fix_entities.status and suggestions.status
   * 3. Fetches and returns the updated fix entity and suggestions
   *
   * @async
   * @param {string} fixEntityId - The ID of the FixEntity to update.
   * @param {string} opportunityId - The ID of the opportunity (validation/logging).
   * @param {string} [newSuggestionStatus='SKIPPED'] - Status for all linked suggestions.
   * @param {string} [newFixEntityStatus] - Status to set on the fix entity (default: ROLLED_BACK).
   * @param {Object} [_] - Optional settings (reserved for future use).
   * @returns {Promise<Object>} - { fix, suggestions }
   * @throws {ValidationError} - If no suggestions found for the fix entity.
   * @throws {DataAccessError} - If the RPC or fetch fails.
   */
  async updateFixAndSuggestionsStatus(
    fixEntityId,
    opportunityId,
    newSuggestionStatus = 'SKIPPED',
    newFixEntityStatus = 'ROLLED_BACK',
    _ = {},
  ) {
    guardId('fixEntityId', fixEntityId, 'FixEntityCollection');
    guardId('opportunityId', opportunityId, 'FixEntityCollection');
    guardString('newSuggestionStatus', newSuggestionStatus, 'FixEntityCollection');
    guardString('newFixEntityStatus', newFixEntityStatus, 'FixEntityCollection');

    try {
      const suggestions = await this.getSuggestionsByFixEntityId(fixEntityId);

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new ValidationError('No suggestions found for the fix entity');
      }

      const { data: rpcResult, error: rpcError } = await this.postgrestService.rpc(
        'rpc_update_fix_and_suggestions_status',
        {
          p_fix_entity_id: fixEntityId,
          p_fix_entity_status: newFixEntityStatus,
          p_new_suggestion_status: newSuggestionStatus,
        },
      );

      if (rpcError) {
        this.log.error('Update fix and suggestions RPC failed', { rpcError, fixEntityId });
        throw new DataAccessError(
          rpcError.message || 'Failed to update fix entity and suggestions',
          this,
          rpcError,
        );
      }

      const [updatedFixEntity, updatedSuggestions] = await Promise.all([
        this.findById(fixEntityId),
        this.getSuggestionsByFixEntityId(fixEntityId),
      ]);

      if (!updatedFixEntity) {
        throw new DataAccessError(`Fix entity ${fixEntityId} not found after update`, this);
      }

      this.log.info(
        `Updated fix entity ${fixEntityId} to ${newFixEntityStatus} and ${updatedSuggestions.length} suggestions`,
        rpcResult ? { rpcResult } : {},
      );

      return {
        fix: updatedFixEntity,
        suggestions: updatedSuggestions,
      };
    } catch (error) {
      this.log.error('Failed to update fix entity and suggestions', error);

      if (error instanceof DataAccessError || error instanceof ValidationError) {
        throw error;
      }

      throw new DataAccessError('Failed to update fix entity and suggestions', this, error);
    }
  }
}

export default FixEntityCollection;
