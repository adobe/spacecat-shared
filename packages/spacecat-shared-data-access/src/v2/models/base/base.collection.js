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

import {
  hasText,
  isNonEmptyObject,
  isObject,
} from '@adobe/spacecat-shared-utils';

import { ElectroValidationError } from 'electrodb';

import { removeElectroProperties } from '../../../../test/it/util/util.js';
import { createAccessors } from '../../util/accessor.utils.js';
import ValidationError from '../../errors/validation.error.js';
import { guardId } from '../../util/guards.js';
import {
  entityNameToAllPKValue,
  isNonEmptyArray,
  keyNamesToIndexName,
} from '../../util/util.js';
import { INDEX_TYPES } from './constants.js';

function isValidParent(parent, child) {
  if (!hasText(parent.entityName)) {
    return false;
  }

  const foreignKey = `${parent.entityName}Id`;

  return child.record?.[foreignKey] === parent.record?.[foreignKey];
}

/**
 * Attempts to find an index name matching a generated name from the given keyNames.
 * If no exact match is found, it progressively shortens the keyNames by removing the last one
 * and tries again. If still no match, it tries the "all" index, and then "primary".
 *
 * @param {object} indexes - The available indexes, keyed by their names.
 * @param {object} keys - The keys to find an index name for.
 * @returns {object} The found index.
 */
function findIndexNameByKeys(indexes, keys) {
  const keyNames = Object.keys(keys);
  for (let { length } = keyNames; length > 0; length -= 1) {
    const subKeyNames = keyNames.slice(0, length);
    const candidateName = keyNamesToIndexName(subKeyNames);
    if (indexes[candidateName]) {
      return candidateName;
    }
  }

  if (indexes.all) {
    return INDEX_TYPES.ALL;
  }

  return INDEX_TYPES.PRIMARY;
}

/**
 * BaseCollection - A base class for managing collections of entities in the application.
 * This class uses ElectroDB to interact with entities and provides common functionality
 * for data operations.
 *
 * @class BaseCollection
 * @abstract
 */
class BaseCollection {
  /**
   * Constructs an instance of BaseCollection.
   * @constructor
   * @param {Object} electroService - The ElectroDB service used for managing entities.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection.
   * @param {Object} schema - The schema for the entity.
   * @param {Object} log - A log for capturing logging information.
   */
  constructor(electroService, entityRegistry, schema, log) {
    this.electroService = electroService;
    this.entityRegistry = entityRegistry;
    this.schema = schema;
    this.log = log;

    this.clazz = this.schema.getModelClass();
    this.entityName = this.schema.getEntityName();
    this.idName = this.schema.getIdName();
    this.entity = electroService.entities[this.entityName];

    this.#initializeCollectionMethods();
  }

  /**
   * Initialize collection methods for each "by..." index defined in the entity schema.
   * For each index that starts with "by", we:
   *  1. Retrieve its composite pk and sk arrays from the schema.
   *  2. Generate convenience methods for every prefix of the composite keys.
   *     For example, if the index keys are ['opportunityId', 'status', 'createdAt'],
   *     we create methods:
   *       - allByOpportunityId(...) / findByOpportunityId(...)
   *       - allByOpportunityIdAndStatus(...) / findByOpportunityIdAndStatus(...)
   *       - allByOpportunityIdAndStatusAndCreatedAt(...) /
   *            findByOpportunityIdAndStatusAndCreatedAt(...)
   *
   * Each generated method calls allByIndexKeys() or findByIndexKeys() with the appropriate keys.
   *
   * @private
   */
  #initializeCollectionMethods() {
    const accessorConfigs = this.schema.toAccessorConfigs(this, this.log);
    createAccessors(accessorConfigs, this.log);
  }

  /**
   * Creates an instance of a model from a record.
   * @private
   * @param {Object} record - The record containing data to create the model instance.
   * @returns {BaseModel|null} - Returns an instance of the model class if the data is valid,
   * otherwise null.
   */
  #createInstance(record) {
    if (!isNonEmptyObject(record)) {
      this.log.warn(`Failed to create instance of [${this.entityName}]: record is empty`);
      return null;
    }
    // eslint-disable-next-line new-cap
    return new this.clazz(
      this.electroService,
      this.entityRegistry,
      this.schema,
      record,
      this.log,
    );
  }

  /**
   * Creates instances of models from a set of records.
   * @private
   * @param {Object} records - The records containing data to create the model instances.
   * @returns {Array<BaseModel>} - An array of instances of the model class.
   */
  #createInstances(records) {
    return records.map((record) => this.#createInstance(record));
  }

  #invalidateCache() {
    this._accessorCache = {};
  }

  /**
   * General method to query entities by index keys. This method is used by other
   * query methods to perform the actual query operation. It will use the index keys
   * to find the appropriate index and query the entities. The query result will be
   * transformed into model instances.
   * @private
   * @param {Object} keys - The index keys to use for the query.
   * @param {Object} options - Additional options for the query.
   * @returns {Promise<BaseModel|Array<BaseModel>|null>} - The query result.
   */
  async #queryByIndexKeys(keys, options = {}) {
    if (!isNonEmptyObject(keys)) {
      const message = `Failed to query [${this.entityName}]: keys are required`;
      this.log.error(message);
      throw new Error(message);
    }

    if (!isObject(options)) {
      const message = `Failed to query [${this.entityName}]: options must be an object`;
      this.log.error(message);
      throw new Error(message);
    }

    const indexName = options.index || findIndexNameByKeys(this.entity.query, keys);
    const index = this.entity.query[indexName];

    if (!index) {
      const message = `Failed to query [${this.entityName}]: index [${indexName}] not found`;
      this.log.error(message);
      throw new Error(message);
    }

    const queryOptions = {
      order: options.order || 'desc',
      ...options.limit && { limit: options.limit },
      ...options.attributes && { attributes: options.attributes },
    };

    let query = index(keys);

    if (isObject(options.between)) {
      query = query.between(
        { [options.between.attribute]: options.between.start },
        { [options.between.attribute]: options.between.end },
      );
    }

    const records = await query.go(queryOptions);

    if (options.limit === 1) {
      if (records.data?.length === 0) {
        return null;
      }
      return this.#createInstance(records.data[0]);
    } else {
      return this.#createInstances(records.data);
    }
  }

  /**
   * Finds all entities in the collection. Requires an index named "all" with a partition key
   * named "pk" with a static value of "ALL_<ENTITYNAME>".
   * @param {Object} [sortKeys] - The sort keys to use for the query.
   * @param {Object} [options] - Additional options for the query.
   * @return {Promise<BaseModel|Array<BaseModel>|null>}
   */
  async all(sortKeys = {}, options = {}) {
    const keys = { pk: entityNameToAllPKValue(this.entityName), ...sortKeys };
    return this.#queryByIndexKeys(keys, options);
  }

  /**
   * Finds entities by a set of index keys. Index keys are used to query entities by
   * a specific index defined in the entity schema. The index keys must match the
   * fields defined in the index.
   * @param {Object} keys - The index keys to use for the query.
   * @param {{index?: string, attributes?: string[]}} [options] - Additional options for the query.
   * @return {Promise<Array<BaseModel>>} - A promise that resolves to an array of model instances.
   * @throws {Error} - Throws an error if the index keys are not provided or if the index
   * is not found.
   * @async
   */
  async allByIndexKeys(keys, options = {}) {
    return this.#queryByIndexKeys(keys, options);
  }

  /**
   * Finds a single entity from the "all" index. Requires an index named "all" with a partition key
   * named "pk" with a static value of "ALL_<ENTITYNAME>".
   * @param {Object} [sortKeys] - The sort keys to use for the query.
   * @param {{index?: string, attributes?: string[]}} [options] - Additional options for the query.
   * @return {Promise<BaseModel|Array<BaseModel>|null>}
   */
  async findByAll(sortKeys = {}, options = {}) {
    if (!isObject(sortKeys)) {
      const message = `Failed to find by all [${this.entityName}]: sort keys must be an object`;
      this.log.error(message);
      throw new Error(message);
    }

    const keys = { pk: entityNameToAllPKValue(this.entityName), ...sortKeys };
    return this.#queryByIndexKeys(keys, { ...options, index: INDEX_TYPES.ALL, limit: 1 });
  }

  /**
   * Finds an entity by its ID.
   * @async
   * @param {string} id - The unique identifier of the entity to be found.
   * @returns {Promise<BaseModel|null>} - A promise that resolves to an instance of
   * the model if found, otherwise null.
   * @throws {Error} - Throws an error if the ID is not provided.
   */
  async findById(id) {
    guardId(this.idName, id, this.entityName);

    const record = await this.entity.get({ [this.idName]: id }).go();

    return this.#createInstance(record?.data);
  }

  /**
   * Finds a single entity by index keys.
   * @param {Object} keys - The index keys to use for the query.
   * @param {{index?: string, attributes?: string[]}} [options] - Additional options for the query.
   * @returns {Promise<BaseModel|null>} - A promise that resolves to the model instance or null.
   * @async
   */
  async findByIndexKeys(keys, options = {}) {
    return this.#queryByIndexKeys(keys, { ...options, limit: 1 });
  }

  /**
   * Creates a new entity in the collection and directly persists it to the database.
   * There is no need to call the save method (which is for updates only) after creating
   * the entity.
   * @async
   * @param {Object} item - The data for the entity to be created.
   * @returns {Promise<BaseModel>} - A promise that resolves to the created model instance.
   * @throws {Error} - Throws an error if the data is invalid or if the creation process fails.
   */
  async create(item) {
    if (!isNonEmptyObject(item)) {
      const message = `Failed to create [${this.entityName}]: data is required`;
      this.log.error(message);
      throw new Error(message);
    }

    try {
      const record = await this.entity.create(item).go();
      const instance = this.#createInstance(record.data);

      this.#invalidateCache();

      return instance;
    } catch (error) {
      this.log.error(`Failed to create [${this.entityName}]`, error);
      throw error;
    }
  }

  /**
   * Validates and batches items for batch operations.
   * @private
   * @param {Array<Object>} items - Items to be validated.
   * @returns {Object} - An object containing validated items and error items.
   */
  #validateItems(items) {
    const validatedItems = [];
    const errorItems = [];

    items.forEach((item) => {
      try {
        const { Item } = this.entity.put(item).params();
        validatedItems.push({ ...removeElectroProperties(Item), ...item });
      } catch (error) {
        if (error instanceof ElectroValidationError) {
          errorItems.push({ item, error: new ValidationError(error) });
        }
      }
    });

    return { validatedItems, errorItems };
  }

  /**
   * Creates multiple entities in the collection and directly persists them to the database in
   * a batch write operation. Batches are written in parallel and are limited to 25 items per batch.
   *
   * @async
   * @param {Array<Object>} newItems - An array of data for the entities to be created.
   * @param {BaseModel} [parent] - Optional parent entity that these items are associated with.
   * @return {Promise<{ createdItems: BaseModel[],
   * errorItems: { item: Object, error: ValidationError }[] }>} - A promise that resolves to
   * an object containing the created items and any items that failed validation.
   * @throws {ValidationError} - Throws a validation error if any of the items has validation
   * failures.
   */
  async createMany(newItems, parent = null) {
    if (!isNonEmptyArray(newItems)) {
      const message = `Failed to create many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new Error(message);
    }

    try {
      const { validatedItems, errorItems } = this.#validateItems(newItems);

      if (validatedItems.length > 0) {
        const response = await this.entity.put(validatedItems).go();

        if (isNonEmptyArray(response?.unprocessed)) {
          this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
        }
      }

      const createdItems = this.#createInstances(validatedItems);

      if (isNonEmptyObject(parent)) {
        createdItems.forEach((record) => {
          if (!isValidParent(parent, record)) {
            this.log.warn(`Failed to associate parent with child [${this.entityName}]: parent is invalid`);
            return;
          }
          // eslint-disable-next-line no-underscore-dangle,no-param-reassign
          record._accessorCache[`get${parent.schema.getModelName()}`] = parent;
        });
      }

      this.#invalidateCache();

      this.log.info(`Created ${createdItems.length} items for [${this.entityName}]`);

      return { createdItems, errorItems };
    } catch (error) {
      this.log.error(`Failed to create many [${this.entityName}]`, error);
      throw error;
    }
  }

  /**
   * Updates a collection of entities in the database using a batch write (put) operation.
   *
   * @async
   * @param {Array<BaseModel>} items - An array of model instances to be updated.
   * @return {Promise<void>} - A promise that resolves when the update operation is complete.
   * @throws {Error} - Throws an error if the update operation fails.
   * @protected
   */
  async _saveMany(items) {
    if (!isNonEmptyArray(items)) {
      const message = `Failed to save many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new Error(message);
    }

    try {
      const updates = items.map((item) => item.record);
      const response = await this.entity.put(updates).go();

      this.#invalidateCache();

      if (response.unprocessed) {
        this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
      }
    } catch (error) {
      this.log.error(`Failed to save many [${this.entityName}]`, error);
      throw error;
    }
  }

  /**
   * Removes all records of this entity based on the provided IDs. This will perform a batch
   * delete operation. This operation does not remove dependent records.
   * @param {Array<string>} ids - An array of IDs to remove.
   * @return {Promise<void>} - A promise that resolves when the removal operation is complete.
   * @throws {Error} - Throws an error if the IDs are not provided or if the
   * removal operation fails.
   */
  async removeByIds(ids) {
    if (!isNonEmptyArray(ids)) {
      const message = `Failed to remove [${this.entityName}]: ids must be a non-empty array`;
      this.log.error(message);
      throw new Error(message);
    }

    this.log.info(`Removing ${ids.length} items for [${this.entityName}]`);
    // todo: consider removing dependent records

    await this.entity.delete(ids.map((id) => ({ [this.idName]: id }))).go();

    this.#invalidateCache();
  }
}

export default BaseCollection;
