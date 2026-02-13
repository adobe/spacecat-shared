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
  guardBoolean,
  guardArray,
  guardEnum,
  guardId,
  guardMap,
  guardNumber,
  guardSet,
  guardString,
} from './index.js';

const checkReadOnly = (propertyName, attribute) => {
  if (attribute.readOnly) {
    throw new ValidationError(`The property ${propertyName} is read-only and cannot be updated.`);
  }
};

const checkUpdatesAllowed = (schema) => {
  if (!schema.allowsUpdates()) {
    throw new ValidationError(`Updates prohibited by schema for ${schema.getModelName()}.`);
  }
};

class Patcher {
  /**
   * Creates a new Patcher instance for an entity.
   * @param {object} collection - The backing collection instance.
   * @param {Schema} schema - The schema for the entity.
   * @param {object} record - The record to patch.
   */
  constructor(collection, schema, record) {
    this.collection = collection;
    this.schema = schema;
    this.record = record;

    this.entityName = schema.getEntityName();
    this.idName = schema.getIdName();

    this.previous = {};
    this.updates = {};

    this.legacyEntity = collection && typeof collection.patch === 'function'
      ? collection
      : null;
    this.patchRecord = null;
  }

  #isAttributeNullable(propertyName) {
    return !this.schema.getAttribute(propertyName)?.required;
  }

  #set(propertyName, attribute, value) {
    const update = {
      [propertyName]: {
        previous: this.record[propertyName],
        current: value,
      },
    };

    const hydratedValue = typeof attribute.get === 'function'
      ? attribute.get(value)
      : value;
    this.record[propertyName] = hydratedValue;
    this.updates = { ...this.updates, ...update };

    if (this.legacyEntity) {
      if (!this.patchRecord) {
        this.patchRecord = this.legacyEntity.patch(this.#getPrimaryKeyValues());
      }
      this.patchRecord = this.patchRecord.set({ [propertyName]: value });
    }
  }

  #getPrimaryKeyValues() {
    const primaryKeys = this.schema.getIndexKeys('primary');
    if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
      return primaryKeys.reduce((acc, key) => {
        acc[key] = this.record[key];
        return acc;
      }, {});
    }
    return { [this.idName]: this.record[this.idName] };
  }

  patchValue(propertyName, value, isReference = false) {
    checkUpdatesAllowed(this.schema);

    const attribute = this.schema.getAttribute(propertyName);
    if (!isObject(attribute)) {
      throw new ValidationError(`Property ${propertyName} does not exist on entity ${this.entityName}.`);
    }

    checkReadOnly(propertyName, attribute);

    const nullable = this.#isAttributeNullable(propertyName);

    if (isReference) {
      guardId(propertyName, value, this.entityName, nullable);
    } else if (Array.isArray(attribute.type)) {
      guardEnum(propertyName, value, attribute.type, this.entityName, nullable);
    } else {
      switch (attribute.type) {
        case 'any':
          guardAny(propertyName, value, this.entityName, nullable);
          break;
        case 'boolean':
          guardBoolean(propertyName, value, this.entityName, nullable);
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

    this.#set(propertyName, attribute, value);
  }

  async save() {
    checkUpdatesAllowed(this.schema);

    if (!this.hasUpdates()) {
      return;
    }

    const previousUpdatedAt = this.record.updatedAt;
    let now = new Date().toISOString();
    if (typeof previousUpdatedAt === 'string' && previousUpdatedAt === now) {
      const previousDate = new Date(previousUpdatedAt);
      if (!Number.isNaN(previousDate.getTime())) {
        now = new Date(previousDate.getTime() + 1000).toISOString();
      }
    }
    this.record.updatedAt = now;
    this.updates.updatedAt = {
      previous: previousUpdatedAt,
      current: now,
    };

    const keys = this.#getPrimaryKeyValues();
    const updates = Object.keys(this.updates).reduce((acc, key) => {
      acc[key] = this.updates[key].current;
      return acc;
    }, {});

    if (this.collection
      && typeof this.collection.applyUpdateWatchers === 'function'
      && typeof this.collection.updateByKeys === 'function') {
      const watched = this.collection.applyUpdateWatchers(this.record, updates);
      this.record = watched.record;
      await this.collection.updateByKeys(keys, watched.updates);
      this.record.updatedAt = previousUpdatedAt;
      return;
    }

    if (this.patchRecord && typeof this.patchRecord.go === 'function') {
      await this.patchRecord.go();
      this.record.updatedAt = previousUpdatedAt;
      return;
    }

    throw new ValidationError(`No persistence strategy available for ${this.entityName}`);
  }

  getUpdates() {
    return this.updates;
  }

  hasUpdates() {
    return Object.keys(this.updates).length > 0;
  }
}

export default Patcher;
