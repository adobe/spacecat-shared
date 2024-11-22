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

import { isObject } from '@adobe/spacecat-shared-utils';

import ValidationError from '../errors/validation.error.js';

import {
  guardAny,
  guardArray,
  guardEnum,
  guardId,
  guardMap,
  guardNumber,
  guardSet,
  guardString,
} from './index.js';

/**
 * Checks if a property is read-only and throws an error if it is.
 * @param {string} propertyName - The name of the property to check.
 * @param {Object} attribute - The attribute to check.
 * @throws {Error} - Throws an error if the property is read-only.
 * @private
 */
const checkReadOnly = (propertyName, attribute) => {
  if (attribute.readOnly) {
    throw new ValidationError(`The property ${propertyName} is read-only and cannot be updated.`);
  }
};

class Patcher {
  constructor(entity, record) {
    this.entity = entity;
    this.entityName = this.entity.model.name.toLowerCase();
    this.model = entity.model;
    this.idName = `${this.model.name.toLowerCase()}Id`;
    this.record = record;
    this.updates = {};

    this.patchRecord = null;
  }

  /**
   * Checks if a property is nullable.
   * @param {string} propertyName - The name of the property to check.
   * @return {boolean} True if the property is nullable, false otherwise.
   * @private
   */
  #isAttributeNullable(propertyName) {
    return !this.model.schema.attributes[propertyName]?.required;
  }

  /**
   * Gets the composite values for a given key from the entity schema.
   * Composite keys have to be provided to ElectroDB in order to update a record across
   * multiple indexes.
   * @param {Object} record - The record to get the composite values from.
   * @param {string} key - The key to get the composite values for.
   * @return {{}} - An object containing the composite values for the given key.
   * @private
   */
  #getCompositeValuesForKey(record, key) {
    const { indexes } = this.model;
    const result = {};

    const processComposite = (index, compositeType) => {
      const compositeArray = index[compositeType]?.facets;
      if (Array.isArray(compositeArray) && compositeArray.includes(key)) {
        compositeArray.forEach((compositeKey) => {
          if (record[compositeKey] !== undefined) {
            result[compositeKey] = record[compositeKey];
          }
        });
      }
    };

    Object.values(indexes).forEach((index) => {
      processComposite(index, 'pk');
      processComposite(index, 'sk');
    });

    return result;
  }

  /**
   * Sets a property on the record and updates the patch record.
   * @param {string} propertyName - The name of the property to set.
   * @param {any} value - The value to set for the property.
   * @private
   */
  #set(propertyName, value) {
    const compositeValues = this.#getCompositeValuesForKey(this.record, propertyName);
    this.patchRecord = this.#getPatchRecord().set({
      ...compositeValues,
      [propertyName]: value,
    });
    this.record[propertyName] = value;
    this.updates[propertyName] = value;
  }

  /**
   * Gets the patch record for the entity. If it does not exist, it will be created.
   * @return {Object} - The patch record for the entity.
   * @private
   */
  #getPatchRecord() {
    if (!this.patchRecord) {
      this.patchRecord = this.entity.patch({ [this.idName]: this.record[this.idName] });
    }
    return this.patchRecord;
  }

  /**
   * Patches a value for a given property on the entity. This method will validate the value
   * against the schema and throw an error if the value is invalid. If the value is declared as
   * a reference, it will validate the ID format.
   * @param {string} propertyName - The name of the property to patch.
   * @param {any} value - The value to patch.
   * @param {boolean} [isReference=false] - Whether the value is a reference to another entity.
   */
  patchValue(propertyName, value, isReference = false) {
    const attribute = this.model.schema?.attributes[propertyName];
    if (!isObject(attribute)) {
      throw new ValidationError(`Property ${propertyName} does not exist on entity ${this.entityName}.`);
    }

    checkReadOnly(propertyName, attribute);

    const nullable = this.#isAttributeNullable(propertyName);

    if (isReference) {
      guardId(propertyName, value, this.entityName, nullable);
    } else {
      switch (attribute.type) {
        case 'any':
          guardAny(propertyName, value, this.entityName, nullable);
          break;
        case 'enum':
          guardEnum(propertyName, value, attribute.enumArray, this.entityName, nullable);
          break;
        case 'list':
          guardArray(propertyName, value, this.entityName, attribute.items?.type, nullable);
          break;
        case 'map':
          guardMap(propertyName, value, this.entityName, nullable);
          break;
        case 'number':
          guardNumber(propertyName, value, this.entityName, nullable);
          break;
        case 'set':
          guardSet(propertyName, value, this.entityName, attribute.items?.type, nullable);
          break;
        case 'string':
          guardString(propertyName, value, this.entityName, nullable);
          break;
        default:
          throw new ValidationError(`Unsupported type for property ${propertyName}`);
      }
    }

    this.#set(propertyName, value);
  }

  /**
   * Saves the current state of the entity to the database.
   * @return {Promise<void>}
   * @throws {Error} - Throws an error if the save operation fails.
   */
  async save() {
    if (!this.hasUpdates()) {
      return;
    }
    await this.#getPatchRecord().go();
    this.record.updatedAt = new Date().getTime();
  }

  getUpdates() {
    return this.updates;
  }

  hasUpdates() {
    return Object.keys(this.updates).length > 0;
  }
}

export default Patcher;
