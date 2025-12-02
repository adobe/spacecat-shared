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

import { guardId } from '../../util/guards.js';
import BaseCollection from '../base/base.collection.js';

/**
 * FixEntitySuggestionCollection - A collection class responsible for managing
 * FixEntitySuggestion junction records. This collection handles the many-to-many
 * relationship between FixEntity and Suggestion entities.
 *
 * This collection provides methods to:
 * - Retrieve junction records by Suggestion ID
 * - Retrieve junction records by FixEntity ID
 *
 * @class FixEntitySuggestionCollection
 * @extends BaseCollection
 */
class FixEntitySuggestionCollection extends BaseCollection {
  static COLLECTION_NAME = 'FixEntitySuggestionCollection';

  /**
   * Gets all junction records associated with a specific Suggestion.
   *
   * @async
   * @param {string} suggestionId - The ID of the Suggestion.
   * @param {Object} options - Additional query options.
   * @returns {Promise<Array>} - A promise that resolves to
   *  an array of FixEntitySuggestion junction records
   * @throws {Error} - Throws an error if the suggestionId is not provided
   */
  async allBySuggestionId(suggestionId, options = {}) {
    guardId('suggestionId', suggestionId, 'FixEntitySuggestionCollection');
    return this.allByIndexKeys({ suggestionId }, options);
  }
}

export default FixEntitySuggestionCollection;
