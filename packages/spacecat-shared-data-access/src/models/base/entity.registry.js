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

import { DataAccessError } from '../../errors/index.js';
import { collectionNameToEntityName } from '../../util/util.js';
import { ENTITY_DEFINITIONS } from './entity-definitions.js';

/**
 * EntityRegistry - A registry class responsible for managing entities, their schema and collection.
 * This implementation uses pure data structures (no static state) to be resilient
 * to bundler duplication.
 *
 * @class EntityRegistry
 */
class EntityRegistry {
  /**
   * Constructs an instance of EntityRegistry.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage entities.
   * @param {Object} log - A logger for capturing and logging information.
   */
  constructor(service, log) {
    this.service = service;
    this.log = log;
    this.collections = new Map();

    this.#initialize();
  }

  /**
   * Initializes the collections managed by the EntityRegistry.
   * This method creates instances of each collection and stores them in an internal map.
   * @private
   */
  #initialize() {
    ENTITY_DEFINITIONS.forEach(({ schema, collection: Collection }) => {
      const collection = new Collection(this.service, this, schema, this.log);
      this.collections.set(Collection.COLLECTION_NAME, collection);
    });
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {DataAccessError} - Throws an error if the collection with the
   * specified name is not found.
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new DataAccessError(`Collection ${collectionName} not found`, this);
    }
    return collection;
  }

  getCollections() {
    const collections = {};
    for (const [key, value] of this.collections) {
      collections[collectionNameToEntityName(key)] = value;
    }
    return collections;
  }
}

export default EntityRegistry;
