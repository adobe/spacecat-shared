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

class ModelFactory {
  constructor(service, logger) {
    this.service = service;
    this.logger = logger;
    this.models = new Map();

    this.initialize();
  }

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

  getCollection(collectionName) {
    const collection = this.models.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    return collection;
  }
}

export default ModelFactory;
