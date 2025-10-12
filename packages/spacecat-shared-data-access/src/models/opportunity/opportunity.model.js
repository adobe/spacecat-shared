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

import BaseModel from '../base/base.model.js';

/**
 * Opportunity - A class representing an Opportunity entity.
 * Provides methods to access and manipulate Opportunity-specific data,
 * such as related suggestions, audit IDs, site IDs, etc.
 *
 * @class Opportunity
 * @extends BaseModel
 */

class Opportunity extends BaseModel {
  static ORIGINS = {
    ESS_OPS: 'ESS_OPS',
    AI: 'AI',
    AUTOMATION: 'AUTOMATION',
  };

  static STATUSES = {
    NEW: 'NEW',
    IN_PROGRESS: 'IN_PROGRESS',
    IGNORED: 'IGNORED',
    RESOLVED: 'RESOLVED',
  };

  /**
   * Adds the given suggestions to this Opportunity. Sets this opportunity as the parent
   * of each suggestion, as such the opportunity ID does not need to be provided.
   *
   * @async
   * @param {Array<Object>} suggestions - An array of suggestion objects to add.
   * @return {Promise<{ createdItems: BaseModel[],
   * errorItems: { item: Object, error: ValidationError }[] }>} - A promise that
   * resolves to an object containing the created suggestion items and any
   * errors that occurred.
   */
  async addSuggestions(suggestions) {
    const childSuggestions = suggestions.map((suggestion) => ({
      ...suggestion,
      [this.idName]: this.getId(),
    }));
    return this.entityRegistry
      .getCollection('SuggestionCollection')
      .createMany(childSuggestions, this);
  }

  /**
   * Adds the given fixEntities to this Opportunity. Sets this opportunity as the parent
   * of each fixEntity, as such the opportunity ID does not need to be provided.
   * Each fixEntity must contain a suggestions array that will be used to create
   * FixEntitySuggestion records.
   *
   * @async
   * @param {Array<Object>} fixEntities - An array of fixEntities objects to add.
   *   Each fixEntity must have a suggestions property with at least one suggestion.
   * @return {Promise<{ createdItems: BaseModel[],
   * errorItems: { item: Object, error: ValidationError }[] }>} - A promise that
   * resolves to an object containing the created fixEntities items and any
   * errors that occurred.
   */
  async addFixEntities(fixEntities) {
    const errorItems = [];
    const opportunityId = this.getId();

    // Step 1: Input validation - categorize fixEntities into valid and invalid
    const validFixEntities = [];
    fixEntities.forEach((fixEntity) => {
      if (!fixEntity.suggestions) {
        errorItems.push({
          item: fixEntity,
          error: new Error('fixEntity must have a suggestions property'),
        });
      } else if (!Array.isArray(fixEntity.suggestions)) {
        errorItems.push({
          item: fixEntity,
          error: new Error('fixEntity.suggestions must be an array'),
        });
      } else if (fixEntity.suggestions.length === 0) {
        errorItems.push({
          item: fixEntity,
          error: new Error('fixEntity.suggestions cannot be empty'),
        });
      } else {
        validFixEntities.push(fixEntity);
      }
    });

    // If no valid fixEntities, return early
    if (validFixEntities.length === 0) {
      return { createdItems: [], errorItems };
    }

    const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');
    const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');
    const fixEntitySuggestionCollection = this.entityRegistry
      .getCollection('FixEntitySuggestionCollection');

    // Step 2: Flatten and fetch all unique suggestion IDs
    const allSuggestionIds = new Set();
    validFixEntities.forEach((fixEntity) => {
      fixEntity.suggestions.forEach((suggestionId) => {
        allSuggestionIds.add(suggestionId);
      });
    });

    const suggestionResults = await suggestionCollection.batchGetByKeys(
      Array.from(allSuggestionIds).map((suggestionId) => ({
        [suggestionCollection.idName]: suggestionId,
      })),
    );

    // Create a map of suggestionId -> suggestion entity for O(1) retrieval
    const suggestionMap = new Map();
    suggestionResults.data.forEach((suggestion) => {
      suggestionMap.set(suggestion.getId(), suggestion);
    });

    // Step 3: Validate that all suggestion IDs exist and prepare fixEntities to create
    const fixEntitiesToCreate = [];
    validFixEntities.forEach((fixEntity) => {
      const missingSuggestions = fixEntity.suggestions.filter(
        (suggestionId) => !suggestionMap.has(suggestionId),
      );

      if (missingSuggestions.length > 0) {
        errorItems.push({
          item: fixEntity,
          error: new Error(`Invalid suggestion IDs: ${missingSuggestions.join(', ')}`),
        });
      } else {
        fixEntitiesToCreate.push(fixEntity);
      }
    });

    // If no valid fixEntities to create, return early
    if (fixEntitiesToCreate.length === 0) {
      return { createdItems: [], errorItems };
    }

    // Step 4: Create FixEntity records
    const fixEntityCreateResult = await fixEntityCollection.createMany(
      fixEntitiesToCreate.map((fixEntity) => {
        const { suggestions: _, ...fixEntityWithoutSuggestions } = fixEntity;
        return {
          ...fixEntityWithoutSuggestions,
          [this.idName]: opportunityId,
        };
      }),
      this,
    );

    // Add any errors from fix entity creation
    if (fixEntityCreateResult.errorItems && fixEntityCreateResult.errorItems.length > 0) {
      // Match error items back to original fixEntities with suggestions
      fixEntityCreateResult.errorItems.forEach((errorItem) => {
        const originalIndex = fixEntitiesToCreate.findIndex(
          (fe) => fe.type === errorItem.item.type
            && JSON.stringify(fe.changeDetails) === JSON.stringify(errorItem.item.changeDetails),
        );
        if (originalIndex !== -1) {
          errorItems.push({
            item: fixEntitiesToCreate[originalIndex],
            error: errorItem.error,
          });
        }
      });
    }

    // Step 5: Create FixEntitySuggestion junction records
    const junctionRecordsToCreate = [];
    fixEntityCreateResult.createdItems.forEach((createdFixEntity, index) => {
      const originalFixEntity = fixEntitiesToCreate[index];
      const fixEntityId = createdFixEntity.getId();
      const fixEntityCreatedAt = createdFixEntity.getCreatedAt();

      originalFixEntity.suggestions.forEach((suggestionId) => {
        junctionRecordsToCreate.push({
          opportunityId,
          fixEntityId,
          suggestionId,
          fixEntityCreatedAt,
        });
      });
    });

    // Create all junction records at once
    if (junctionRecordsToCreate.length > 0) {
      await fixEntitySuggestionCollection.createMany(junctionRecordsToCreate);
    }

    return {
      createdItems: fixEntityCreateResult.createdItems,
      errorItems,
    };
  }
}

export default Opportunity;
