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

import { isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import { ElectroValidationError } from 'electrodb';

import ValidationError from '../errors/validation.error.js';
import { guardId } from '../util/guards.js';
import { keyNamesToIndexName } from '../util/reference.js';

/**
 * BaseCollection - A base class for managing collections of entities in the application.
 * This class uses ElectroDB to interact with entities and provides common functionality
 * for data operations.
 *
 * @class BaseCollection
 */
class BaseCollection {
  /**
   * Constructs an instance of BaseCollection.
   * @constructor
   * @param {Object} electroService - The ElectroDB service used for managing entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {BaseModel} clazz - The model class that represents the entity.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(electroService, modelFactory, clazz, log) {
    this.electroService = electroService;
    this.modelFactory = modelFactory;
    this.clazz = clazz;
    this.entityName = this.clazz.name.toLowerCase();
    this.entity = electroService.entities[this.entityName];
    this.idName = `${this.entityName}Id`;
    this.log = log;
  }

  /**
   * Creates an instance of a model from a record.
   * @private
   * @param {Object} record - The record containing data to create the model instance.
   * @returns {BaseModel|null} - Returns an instance of the model class if the data is valid,
   * otherwise null.
   */
  #createInstance(record) {
    if (!isNonEmptyObject(record?.data)) {
      this.log.warn(`Failed to create instance of [${this.entityName}]: record is empty`);
      return null;
    }
    // eslint-disable-next-line new-cap
    return new this.clazz(
      this.electroService,
      this.modelFactory,
      record.data,
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
    if (!Array.isArray(records?.data)) {
      this.log.warn(`Failed to create instances of [${this.entityName}]: records are empty`);
      return [];
    }
    return records.data.map((record) => this.#createInstance({ data: record }));
  }

  /**
   * Retrieves the enum values for a field in the entity schema. Useful for validating
   * enum values prior to creating or updating an entity.
   * @param {string} fieldName - The name of the field to retrieve enum values for.
   * @return {string[]} - An array of enum values for the field.
   * @protected
   */
  _getEnumValues(fieldName) {
    return this.entity.model.schema.attributes[fieldName]?.enumArray;
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

    return this.#createInstance(record);
  }

  /**
   * Finds entities by a set of index keys. Index keys are used to query entities by
   * a specific index defined in the entity schema. The index keys must match the
   * fields defined in the index.
   * @param {Object} keys - The index keys to use for the query.
   * @return {Promise<Array<BaseModel>>} - A promise that resolves to an array of model instances.
   * @throws {Error} - Throws an error if the index keys are not provided or if the index
   * is not found.
   * @async
   */
  async findByIndexKeys(keys) {
    if (!isNonEmptyObject(keys)) {
      const message = `Failed to find by index keys [${this.entityName}]: keys are required`;
      this.log.error(message);
      throw new Error(message);
    }

    const indexName = keyNamesToIndexName(Object.keys(keys));
    const index = this.entity.query[indexName];

    if (!index) {
      const message = `Failed to find by index keys [${this.entityName}]: index [${indexName}] not found`;
      this.log.error(message);
      throw new Error(message);
    }

    const records = await index(keys).go();

    return this.#createInstances(records);
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
      // todo: catch ElectroDB validation errors and re-throws as ValidationError
      // todo: validate associations
      const record = await this.entity.create(item).go();
      return this.#createInstance(record);
    } catch (error) {
      this.log.error(`Failed to create [${this.entityName}]`, error);
      throw error;
    }
  }

  /**
   * Creates multiple entities in the collection and directly persists them to the database in
   * a batch write operation. Batches are written in parallel and are limited to 25 items per batch.
   *
   * @async
   * @param {Array<Object>} newItems - An array of data for the entities to be created.
   * @param {BaseModel} [parent] - Optional parent entity that these items are associated with.
   * @return {Promise<{ createdItems: BaseModel[],
   * errorItems: { item: Object, error: ElectroValidationError }[] }>} - A promise that resolves to
   * an object containing the created items and any items that failed validation.
   * @throws {ValidationError} - Throws a validation error if any of the items has validation
   * failures.
   */
  async createMany(newItems, parent = null) {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      const message = `Failed to create many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new Error(message);
    }

    try {
      const validatedItems = [];
      const errorItems = [];
      const createdItems = [];

      newItems.forEach((item) => {
        try {
          this.entity.put(item).params();
          validatedItems.push(item);
        } catch (error) {
          if (error instanceof ElectroValidationError) {
            errorItems.push({ item, error: new ValidationError(error) });
          }
        }
      });

      /**
       * ElectroDB does not return the created items in the response for batch write operations.
       * This listener intercepts the batch write requests and extracts the items before they
       * are stored in the database.
       * @param {Object} result - The result of the operation.
       */
      const requestItemsListener = (result) => {
        if (result?.type !== 'query' || result?.method !== 'batchWrite') {
          return;
        }

        result.params?.RequestItems[this.entity.model.table].forEach((putRequest) => {
          createdItems.push(putRequest.PutRequest.Item);
        });
      };

      let records = [];
      if (validatedItems.length > 0) {
        const response = await this.entity.put(validatedItems).go(
          { listeners: [requestItemsListener] },
        );
        records = this.#createInstances({ data: createdItems });

        if (Array.isArray(response.unprocessed) && response.unprocessed.length > 0) {
          this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
        }
      }

      if (parent) {
        records.forEach((record) => {
          // eslint-disable-next-line no-underscore-dangle
          record._cacheReference(parent.entity.model.name, parent);
        });
      }

      return { createdItems: records, errorItems };
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
    if (!Array.isArray(items) || items.length === 0) {
      const message = `Failed to save many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new Error(message);
    }

    try {
      const updates = items.map((item) => item.record);
      const response = await this.entity.put(updates).go();

      if (response.unprocessed) {
        this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
      }
    } catch (error) {
      this.log.error(`Failed to save many [${this.entityName}]`, error);
      throw error;
    }
  }
}

export default BaseCollection;
