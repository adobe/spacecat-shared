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

import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresOpportunityModel extends PostgresBaseModel {
  static ENTITY_NAME = 'Opportunity';

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

  async addSuggestions(suggestions) {
    const childSuggestions = suggestions.map((suggestion) => ({
      ...suggestion,
      [this.idName]: this.getId(),
    }));
    return this.entityRegistry
      .getCollection('SuggestionCollection')
      .createMany(childSuggestions, this);
  }

  async addFixEntities(fixEntities) {
    const errorItems = [];
    const opportunityId = this.getId();

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

    if (validFixEntities.length === 0) {
      return { createdItems: [], errorItems };
    }

    const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');
    const suggestionCollection = this.entityRegistry.getCollection('SuggestionCollection');
    const fixEntitySuggestionCollection = this.entityRegistry
      .getCollection('FixEntitySuggestionCollection');

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

    const suggestionMap = new Map();
    suggestionResults.data.forEach((suggestion) => {
      suggestionMap.set(suggestion.getId(), suggestion);
    });

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

    if (fixEntitiesToCreate.length === 0) {
      return { createdItems: [], errorItems };
    }

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

    if (fixEntityCreateResult.errorItems && fixEntityCreateResult.errorItems.length > 0) {
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

    const junctionRecordsToCreate = [];
    fixEntityCreateResult.createdItems.forEach((createdFixEntity, index) => {
      const originalFixEntity = fixEntitiesToCreate[index];
      const fixEntityId = createdFixEntity.getId();
      const fixEntityCreatedAt = createdFixEntity.getExecutedAt()
        || createdFixEntity.getCreatedAt();

      originalFixEntity.suggestions.forEach((suggestionId) => {
        junctionRecordsToCreate.push({
          opportunityId,
          fixEntityId,
          suggestionId,
          fixEntityCreatedAt,
        });
      });
    });

    if (junctionRecordsToCreate.length > 0) {
      await fixEntitySuggestionCollection.createMany(junctionRecordsToCreate);
    }

    return {
      createdItems: fixEntityCreateResult.createdItems,
      errorItems,
    };
  }
}

export default PostgresOpportunityModel;
