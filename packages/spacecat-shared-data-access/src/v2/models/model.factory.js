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

import OpportunityCollection from './opportunity.collection.js';
import SuggestionCollection from './suggestion.collection.js';

/**
 * ModelFactory - A factory class responsible for creating and managing collections
 * of different models. This class serves as a centralized point for accessing and
 * instantiating model collections.
 *
 * @class ModelFactory
 */
class ModelFactory {
  /**
   * Constructs an instance of ModelFactory.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage entities.
   * @param {Object} logger - A logger for capturing and logging information.
   */
  constructor(service, logger) {
    this.service = service;
    this.logger = logger;
    this.models = new Map();

    this.initialize();
  }

  /**
   * Initializes the collections managed by the ModelFactory.
   * This method creates instances of each collection and stores them in an internal map.
   * @private
   */
  initialize() {
    const opportunityCollection = new OpportunityCollection(
      this.service,
      this,
      this.logger,
    );
    const suggestionCollection = new SuggestionCollection(
      this.service,
      this,
      this.logger,
    );

    this.models.set(OpportunityCollection.name, opportunityCollection);
    this.models.set(SuggestionCollection.name, suggestionCollection);
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {Error} - Throws an error if the collection with the specified name is not found.
   */
  getCollection(collectionName) {
    const collection = this.models.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    return collection;
  }
}

export default ModelFactory;
