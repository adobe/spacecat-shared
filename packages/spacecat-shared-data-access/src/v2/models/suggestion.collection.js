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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseCollection from './base.collection.js';
import Suggestion from './suggestion.model.js';

/**
 * SuggestionCollection - A collection class responsible for managing Suggestion entities.
 * Extends the BaseCollection to provide specific methods for interacting with Suggestion records.
 *
 * @class SuggestionCollection
 * @extends BaseCollection
 */
class SuggestionCollection extends BaseCollection {
  /**
   * Constructs an instance of SuggestionCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage Suggestion entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, Suggestion, log);
  }

  /**
   * Retrieves all Suggestion entities by their associated Opportunity ID.
   * @async
   * @param {string} opportunityId - The unique identifier of the associated Opportunity.
   * @returns {Promise<Suggestion[]>} - A promise that resolves to an array of Suggestion
   * instances related to the given Opportunity ID.
   * @throws {Error} - Throws an error if the opportunityId is not provided or if the query fails.
   */
  async allByOpportunityId(opportunityId) {
    if (!hasText(opportunityId)) {
      throw new Error('OpportunityId is required');
    }
    return this.findByIndexKeys({ opportunityId });
  }

  /**
   * Retrieves all Suggestion entities by their associated Opportunity ID and status.
   * @param {string} opportunityId - The unique identifier of the associated Opportunity.
   * @param {string} status - The status of the Suggestion entities
   * @return {Promise<BaseModel[]>} - A promise that resolves to an array of
   * Suggestion instances.
   * @throws {Error} - Throws an error if the opportunityId or status is not provided.
   */
  async allByOpportunityIdAndStatus(opportunityId, status) {
    if (!hasText(opportunityId)) {
      throw new Error('OpportunityId is required');
    }

    if (!hasText(status)) {
      throw new Error('Status is required');
    }

    return this.findByIndexKeys({ opportunityId, status });
  }

  /**
   * Updates the status of multiple given suggestions. The given status must conform
   * to the status enum defined in the Suggestion schema.
   * Saves the updated suggestions to the database automatically.
   * You don't need to call save() on the suggestions after calling this method.
   * @async
   * @param {Suggestion[]} suggestions - An array of Suggestion instances to update.
   * @param {string} status - The new status to set for the suggestions.
   * @return {Promise<*>} - A promise that resolves to the updated suggestions.
   * @throws {Error} - Throws an error if the suggestions are not provided
   * or if the status is invalid.
   */
  async bulkUpdateStatus(suggestions, status) {
    if (!Array.isArray(suggestions)) {
      throw new Error('Suggestions must be an array');
    }

    const validStatuses = this._getEnumValues('status');
    if (!validStatuses?.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    suggestions.forEach((suggestion) => {
      suggestion.setStatus(status);
    });

    await this._saveMany(suggestions);

    return suggestions;
  }
}

export default SuggestionCollection;
