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

import PostgresBaseCollection from '../base/postgres-base.collection.js';
import PostgresFixEntityModel from './fix-entity.pg.model.js';
import DataAccessError from '../../../errors/data-access.error.js';
import ValidationError from '../../../errors/validation.error.js';
import { guardId, guardArray, guardString } from '../../../util/guards.js';
import { resolveUpdates } from '../../../util/util.js';

class PostgresFixEntityCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'FixEntityCollection';

  static MODEL_CLASS = PostgresFixEntityModel;

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

  async setSuggestionsForFixEntity(opportunityId, fixEntity, suggestions) {
    guardId('opportunityId', opportunityId, 'FixEntityCollection');
    guardArray('suggestions', suggestions, 'FixEntityCollection', 'any');

    if (!fixEntity) {
      throw new ValidationError('fixEntity is required');
    }

    const fixEntityId = fixEntity.getId();
    const fixEntityCreatedAt = fixEntity.getExecutedAt() || fixEntity.getCreatedAt();
    const suggestionIds = suggestions.map((suggestion) => suggestion.getId());

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');

      const existingRelationships = await fixEntitySuggestionCollection
        .allByFixEntityId(fixEntityId);

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

  async getAllFixesWithSuggestionByCreatedAt(opportunityId, fixEntityCreatedDate) {
    guardId('opportunityId', opportunityId, 'FixEntityCollection');
    guardString('fixEntityCreatedDate', fixEntityCreatedDate, 'FixEntityCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');
      const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');

      const fixEntitySuggestions = await fixEntitySuggestionCollection
        .allByOpportunityIdAndFixEntityCreatedDate(opportunityId, fixEntityCreatedDate);

      if (fixEntitySuggestions.length === 0) {
        return [];
      }

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

      const fixEntities = await this.batchGetByKeys(
        Array.from(fixEntityIds).map((id) => ({ [this.idName]: id })),
      );

      const allSuggestionIds = Object.values(suggestionsByFixEntityId).flat();
      const suggestionsResult = await suggestionCollection.batchGetByKeys(
        allSuggestionIds.map((id) => ({ [suggestionCollection.idName]: id })),
      );

      const suggestionsById = {};
      for (const suggestion of suggestionsResult.data) {
        suggestionsById[suggestion.getId()] = suggestion;
      }

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
}

export default PostgresFixEntityCollection;
