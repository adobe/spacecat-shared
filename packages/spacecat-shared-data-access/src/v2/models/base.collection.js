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

import { guardId } from '../util/guards.js';

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
   * @param {Class} clazz - The model class that represents the entity.
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
   * @protected
   * @param {Object} record - The record containing data to create the model instance.
   * @returns {BaseModel|null} - Returns an instance of the model class if the data is valid,
   * otherwise null.
   */
  _createInstance(record) {
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
   * @protected
   * @param {Object} records - The records containing data to create the model instances.
   * @returns {Array<BaseModel>} - An array of instances of the model class.
   */
  _createInstances(records) {
    if (!Array.isArray(records?.data)) {
      this.log.warn(`Failed to create instances of [${this.entityName}]: records are empty`);
      return [];
    }
    return records.data.map((record) => this._createInstance({ data: record }));
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

    return this._createInstance(record);
  }

  /**
   * Creates a new entity in the collection.
   * @async
   * @param {Object} data - The data for the entity to be created.
   * @returns {Promise<BaseModel>} - A promise that resolves to the created model instance.
   * @throws {Error} - Throws an error if the data is invalid or if the creation process fails.
   */
  async create(data) {
    if (!isNonEmptyObject(data)) {
      this.log.error(`Failed to create [${this.entityName}]: data is required`);
      throw new Error(`Failed to create [${this.entityName}]: data is required`);
    }

    try {
      // todo: validate associations
      const record = await this.entity.create(data).go();
      return this._createInstance(record);
    } catch (error) {
      this.log.error(`Failed to create [${this.entityName}]`, error);
      throw error;
    }
  }
}

export default BaseCollection;
