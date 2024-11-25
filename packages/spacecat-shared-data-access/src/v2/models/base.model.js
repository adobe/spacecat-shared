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

import Patcher from '../util/patcher.js';
import {
  entityNameToCollectionName,
  entityNameToIdName,
  entityNameToReferenceMethodName,
} from '../util/reference.js';

/**
 * Base - A base class for representing individual entities in the application.
 * Provides common functionality for entity management, including fetching, updating,
 * and deleting records.
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

    this.patcher = new Patcher(this.entity, this.record);

    this.referencesCache = {};
    this._initializeReferences();
  }

  _initializeReferences() {
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

  _getCachedReference(targetName) {
    return this.referencesCache[targetName];
  }

  _cacheReference(targetName, reference) {
    this.referencesCache[targetName] = reference;
  }

  async _fetchReference(type, targetName) { /* eslint-disable no-underscore-dangle */
    let result = this._getCachedReference(targetName);
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
      result = await targetCollection.findByIndexKeys({ [foreignKey]: this.getId() });
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
}

export default BaseModel;
