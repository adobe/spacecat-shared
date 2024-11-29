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

import Patcher from '../../util/patcher.js';
import {
  capitalize,
  entityNameToCollectionName,
  entityNameToIdName,
  entityNameToReferenceMethodName, idNameToEntityName,
} from '../../util/reference.js';

/**
 * Base - A base class for representing individual entities in the application.
 * Provides common functionality for entity management, including fetching, updating,
 * and deleting records. This class is intended to be extended by specific entity classes
 * that represent individual entities in the application. The BaseModel class provides
 * methods for fetching associated entities based on the type of relationship
 * (belongs_to, has_one, has_many).
 * The fetched references are cached to avoid redundant database queries. If the reference
 * is already cached, it will be returned directly.
 * Attribute values can be accessed and modified using getter and setter methods that are
 * automatically generated based on the entity schema. The BaseModel class also provides
 * methods for removing and saving entities to the database.
 *
 * @class BaseModel
 */
class BaseModel {
  /**
   * Constructs an instance of BaseModel.
   * @constructor
   * @param {Object} electroService - The ElectroDB service used for managing entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} record - The initial data for the entity instance.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(electroService, modelFactory, record, log) {
    this.modelFactory = modelFactory;
    this.record = record;
    this.entityName = this.constructor.name.toLowerCase();
    this.entity = electroService.entities[this.entityName];
    this.idName = `${this.entityName}Id`;
    this.log = log;
    this.referencesCache = {};

    this.patcher = new Patcher(this.entity, this.record);

    this.#initializeReferences();
    this.#initializeAttributes();
  }

  /**
   * Initializes the references for the current entity.
   * This method is called during the construction of the entity instance
   * to set up the reference methods for fetching associated entities.
   * @private
   */
  #initializeReferences() {
    const { references } = this.entity.model.original;
    if (!isNonEmptyObject(references)) {
      return;
    }

    for (const [type, refs] of Object.entries(references)) {
      refs.forEach((ref) => {
        const { target } = ref;
        const methodName = entityNameToReferenceMethodName(target, type);

        this[methodName] = async () => this._fetchReference(type, target);
      });
    }
  }

  #initializeAttributes() {
    const { attributes } = this.entity.model.schema;

    if (!isNonEmptyObject(attributes)) {
      return;
    }

    for (const [name, attr] of Object.entries(attributes)) {
      const capitalized = capitalize(name);
      const getterMethodName = `get${capitalized}`;
      const setterMethodName = `set${capitalized}`;
      const isReference = this.entity.model.original
        .references?.belongs_to?.some((ref) => ref.target === idNameToEntityName(name));

      if (!this[getterMethodName] || name === this.idName) {
        this[getterMethodName] = () => this.record[name];
      }

      if (!this[setterMethodName] && !attr.readOnly) {
        this[setterMethodName] = (value) => {
          this.patcher.patchValue(name, value, isReference);
          return this;
        };
      }
    }
  }

  /**
   * Gets a cached reference for the specified entity.
   * @param {string} targetName - The name of the entity to fetch.
   * @return {*}
   */
  #getCachedReference(targetName) {
    return this.referencesCache[targetName];
  }

  /**
   * Caches a reference for the specified entity. This method is used to store
   * fetched references to avoid redundant database queries.
   * @param {string} targetName - The name of the entity to cache.
   * @param {*} reference - The reference to cache.
   * @private
   */
  _cacheReference(targetName, reference) {
    this.referencesCache[targetName] = reference;
  }

  /**
   * Fetches a reference for the specified entity. This method is used to fetch
   * associated entities based on the type of relationship (belongs_to, has_one, has_many).
   * The fetched references are cached to avoid redundant database queries. If the reference
   * is already cached, it will be returned directly.
   * References are defined in the entity model and are used to fetch associated entities.
   * @async
   * @param {string} type - The type of relationship (belongs_to, has_one, has_many).
   * @param {string} targetName - The name of the entity to fetch.
   * @return {Promise<*|null>} - A promise that resolves to the fetched reference or null if
   * not found.
   * @private
   */
  async _fetchReference(type, targetName) { /* eslint-disable no-underscore-dangle */
    let result = this.#getCachedReference(targetName);
    if (result) {
      return result;
    }

    const collectionName = entityNameToCollectionName(targetName);
    const targetCollection = this.modelFactory.getCollection(collectionName);

    if (type === 'belongs_to' || type === 'has_one') {
      const foreignKey = entityNameToIdName(targetName);
      const id = this.record[foreignKey];
      if (!id) return null;

      result = await targetCollection.findById(id);
    } else if (type === 'has_many') {
      const foreignKey = entityNameToIdName(this.entityName);
      result = await targetCollection.allByIndexKeys({ [foreignKey]: this.getId() });
    }

    if (result) {
      await this._cacheReference(targetName, result);
    }

    return result;
  }

  /**
   * Gets the ID of the current entity.
   * @returns {string} - The unique identifier of the entity.
   */
  getId() {
    return this.record[this.idName];
  }

  /**
   * Gets the creation timestamp of the current entity.
   * @returns {string} - The ISO string representing when the entity was created.
   */
  getCreatedAt() {
    return new Date(this.record.createdAt).toISOString();
  }

  /**
   * Gets the update timestamp of the current entity.
   * @returns {string} - The ISO string representing when the entity was last updated.
   */
  getUpdatedAt() {
    return new Date(this.record.updatedAt).toISOString();
  }

  /**
   * Removes the current entity from the database.
   * @async
   * @returns {Promise<BaseModel>} - A promise that resolves to the current instance of the entity
   * after it has been removed.
   * @throws {Error} - Throws an error if the removal fails.
   */
  async remove() {
    try {
      // todo: remove dependents (child associations)
      await this.entity.remove({ [this.idName]: this.getId() }).go();
      return this;
    } catch (error) {
      this.log.error('Failed to remove record', error);
      throw error;
    }
  }

  /**
   * Saves the current entity to the database. This method must be called after making changes
   * to the entity via their respective setter methods.
   * @async
   * @returns {Promise<BaseModel>} - A promise that resolves to the current instance of the entity
   * after it has been saved.
   * @throws {Error} - Throws an error if the save operation fails.
   */
  async save() {
    // todo: validate associations
    try {
      await this.patcher.save();
      // todo: in case references are updated, clear or refresh references cache
      return this;
    } catch (error) {
      this.log.error('Failed to save record', error);
      throw error;
    }
  }

  /**
   * Converts the entity attributes to a JSON object.
   * @returns {Object} - A JSON representation of the entity attributes.
   */
  toJSON() {
    const { attributes } = this.entity.model.schema;

    return Object.keys(attributes).reduce((json, key) => {
      if (this.record[key] !== undefined) {
        // eslint-disable-next-line no-param-reassign
        json[key] = this.record[key];
      }
      return json;
    }, {});
  }
}

export default BaseModel;
