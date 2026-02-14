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

import DataAccessError from '../../../errors/data-access.error.js';
import { guardId } from '../../../util/guards.js';
import PostgresBaseCollection from '../base/postgres-base.collection.js';
import PostgresSuggestionModel from './suggestion.pg.model.js';

class PostgresSuggestionCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'SuggestionCollection';

  static MODEL_CLASS = PostgresSuggestionModel;

  async bulkUpdateStatus(suggestions, status) {
    if (!Array.isArray(suggestions)) {
      throw new Error('Suggestions must be an array');
    }

    if (!Object.values(PostgresSuggestionModel.STATUSES).includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${Object.values(PostgresSuggestionModel.STATUSES).join(', ')}`);
    }

    suggestions.forEach((suggestion) => {
      suggestion.setStatus(status);
    });

    await this._saveMany(suggestions);

    return suggestions;
  }

  async getFixEntitiesBySuggestionId(suggestionId) {
    guardId('suggestionId', suggestionId, 'SuggestionCollection');

    try {
      const fixEntitySuggestionCollection = this.entityRegistry.getCollection('FixEntitySuggestionCollection');
      const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');

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
}

export default PostgresSuggestionCollection;
