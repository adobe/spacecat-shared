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

import { DataAccessError } from '../../errors/index.js';
import { collectionNameToEntityName, decapitalize } from '../../util/util.js';
import ConfigurationCollection from '../../models/configuration/configuration.collection.js';

/**
 * PostgresEntityRegistry - A registry class responsible for managing Postgres-backed entities,
 * their schema and collection. Mirrors the v2 EntityRegistry interface but creates
 * PostgresBase* instances instead of ElectroDB-backed ones.
 *
 * @class PostgresEntityRegistry
 */
class PostgresEntityRegistry {
  static entities = {};

  /**
   * Constructs an instance of PostgresEntityRegistry.
   * @constructor
   * @param {Object} postgrestClient - The PostgREST client for database operations.
   * @param {Object} config - Configuration with optional s3 service.
   * @param {{s3Client: S3Client, s3Bucket: string}|null} [config.s3] - S3 config for
   *   Configuration collection.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(postgrestClient, config, log) {
    this.postgrestClient = postgrestClient;
    this.config = config;
    this.log = log;
    this.collections = new Map();

    this.#initialize();
  }

  /**
   * Initializes all registered entity collections.
   * PostgREST-backed collections receive the PostgREST client.
   * Configuration collection continues to use S3.
   * @private
   */
  #initialize() {
    Object.values(PostgresEntityRegistry.entities).forEach(
      ({ collection: Collection, schema }) => {
        const collection = new Collection(this.postgrestClient, this, schema, this.log);
        this.collections.set(Collection.COLLECTION_NAME, collection);
      },
    );

    // Configuration: stays S3-based
    if (this.config.s3) {
      const configCollection = new ConfigurationCollection(this.config.s3, this.log);
      this.collections.set(ConfigurationCollection.COLLECTION_NAME, configCollection);
    }
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {DataAccessError} - If the collection is not found.
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new DataAccessError(`Collection ${collectionName} not found`, this);
    }
    return collection;
  }

  /**
   * Gets all collections keyed by entity name (without "Collection" suffix).
   * @returns {Object} - Dictionary of collections.
   */
  getCollections() {
    const collections = {};
    for (const [key, value] of this.collections) {
      collections[collectionNameToEntityName(key)] = value;
    }
    return collections;
  }

  /**
   * Registers an entity (schema + collection class) in the registry.
   * @param {Schema} schema - The schema for the entity.
   * @param {Function} collection - The collection class.
   */
  static registerEntity(schema, collection) {
    this.entities[decapitalize(schema.getEntityName())] = { schema, collection };
  }
}

// Entity registration happens in Task 7/8 when entity-specific Postgres collections
// are created. For now, the registry is empty and will be populated as entities are added.

export default PostgresEntityRegistry;
