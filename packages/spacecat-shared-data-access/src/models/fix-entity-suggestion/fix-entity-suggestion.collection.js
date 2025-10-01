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
   * Find all fix entities for a given suggestion using primary index
   * @param {string} suggestionId - The ID of the suggestion
   * @returns {Promise<FixEntitySuggestion[]>} Array of junction records
   */
  async allBySuggestionId(suggestionId) {
    try {
      const result = await this.entity.query.primary({ suggestionId }).go();
      return result.data.map((item) => this.createInstance(item));
    } catch (error) {
      this.log.error(`Failed to query FixEntitySuggestions by suggestionId: ${error.message}`);
      throw error;
    }
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
   * Find a specific relationship between a fix entity and suggestion
   * @param {string} suggestionId - The ID of the suggestion (PK)
   * @param {string} fixEntityId - The ID of the fix entity (SK)
   * @returns {Promise<FixEntitySuggestion|null>} The junction record or null
   */
  async findRelationship(suggestionId, fixEntityId) {
    try {
      const result = await this.entity.get({ suggestionId, fixEntityId }).go();
      return this.createInstance(result.data);
    } catch (error) {
      if (error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Remove a relationship between a fix entity and suggestion
   * @param {string} suggestionId - The ID of the suggestion (PK)
   * @param {string} fixEntityId - The ID of the fix entity (SK)
   * @returns {Promise<void>}
   */
  async removeRelationship(suggestionId, fixEntityId) {
    try {
      await this.entity.delete({ suggestionId, fixEntityId }).go();
    } catch (error) {
      // Ignore "not found" errors since the goal is to ensure the relationship doesn't exist
      if (!error.message?.includes('not found')) {
        throw error;
      }
    }
  }
}

export default FixEntitySuggestionCollection;
