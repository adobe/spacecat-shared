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

/**
 * FixEntitySuggestionCollection - A collection class responsible for managing
 * FixEntitySuggestion junction records. This collection handles the many-to-many
 * relationship between FixEntity and Suggestion entities.
 *
 * @class FixEntitySuggestionCollection
 * @extends BaseCollection
 */
class FixEntitySuggestionCollection extends BaseCollection {
  /**
   * Find all suggestions for a given fix entity
   * @param {string} fixEntityId - The ID of the fix entity
   * @returns {Promise<FixEntitySuggestion[]>} Array of junction records
   */
  async allByFixEntityId(fixEntityId) {
    return this.allByForeignKey('fixEntityId', fixEntityId);
  }

  /**
   * Find all fix entities for a given suggestion
   * @param {string} suggestionId - The ID of the suggestion
   * @returns {Promise<FixEntitySuggestion[]>} Array of junction records
   */
  async allBySuggestionId(suggestionId) {
    return this.allByForeignKey('suggestionId', suggestionId);
  }

  /**
   * Create a relationship between a fix entity and suggestion
   * @param {string} fixEntityId - The ID of the fix entity
   * @param {string} suggestionId - The ID of the suggestion
   * @returns {Promise<FixEntitySuggestion>} The created junction record
   */
  async createRelationship(fixEntityId, suggestionId) {
    return this.create({
      fixEntityId,
      suggestionId,
    });
  }

  /**
   * Remove a relationship between a fix entity and suggestion
   * @param {string} fixEntityId - The ID of the fix entity
   * @param {string} suggestionId - The ID of the suggestion
   * @returns {Promise<void>}
   */
  async removeRelationship(fixEntityId, suggestionId) {
    const relationships = await this.entity
      .query.fixEntityId({ fixEntityId })
      .where(({ suggestionId: sid }, { eq }) => eq(sid, suggestionId))
      .go();

    if (relationships.data && relationships.data.length > 0) {
      await this.remove(relationships.data[0].id);
    }
  }
}

export default FixEntitySuggestionCollection;
