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
   * @returns {Promise<Array<Suggestion>>} - A promise that resolves to an array of Suggestion
   * instances related to the given Opportunity ID.
   * @throws {Error} - Throws an error if the opportunityId is not provided or if the query fails.
   */
  async allByOpportunityId(opportunityId) {
    if (!hasText(opportunityId)) {
      throw new Error('OpportunityId is required');
    }

    const records = await this.entity.query.byOpportunityId({ opportunityId }).go();

    return this._createInstances(records);
  }
}

export default SuggestionCollection;
