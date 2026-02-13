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

/**
 * PostgresPatcher - Tracks attribute changes on a model and persists them
 * via the owning collection's updateByKeys method. Unlike the v2 Patcher
 * which uses ElectroDB patch records, this delegates entirely to PostgREST
 * through the collection layer.
 */
class PostgresPatcher {
  /**
   * Creates a new PostgresPatcher instance.
   * @param {PostgresBaseCollection} collection - The backing collection instance.
   * @param {Schema} schema - The schema for the entity.
   * @param {object} record - The record to patch.
   */
  constructor(collection, schema, record) {
    this.collection = collection;
    this.schema = schema;
    this.record = record;

    this.entityName = schema.getEntityName();
    this.idName = schema.getIdName();

    // holds the updates to the attributes (with previous and current values)
    this.updates = {};
  }

  #isAttributeNullable(propertyName) {
    return !this.schema.getAttribute(propertyName)?.required;
  }

  #set(propertyName, value) {
    const update = {
      [propertyName]: {
        previous: this.record[propertyName],
        current: value,
      },
    };

    this.record[propertyName] = value;
    this.updates = { ...this.updates, ...update };
  }

  #getPrimaryKeyValues() {
    const primaryKeys = this.schema.getIndexKeys('primary');
    if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
      return primaryKeys.reduce((acc, key) => {
        acc[key] = this.record[key];
        return acc;
      }, {});
    }
    /* c8 ignore next 1 -- fallback for schemas without primary index keys */
    return { [this.idName]: this.record[this.idName] };
  }

  /**
   * Patches a value for a given property on the entity. Validates the value
   * against the schema and tracks the change for later persistence.
   * @param {string} propertyName - The name of the property to patch.
   * @param {any} value - The value to patch.
   * @param {boolean} [isReference=false] - Whether the value is a reference to another entity.
   */
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
        /* c8 ignore next 3 -- enum with explicit enumArray is rare; array shorthand is preferred */
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
   * Saves all tracked changes to the database via the collection's updateByKeys.
   * Also updates the updatedAt timestamp and applies update watchers.
   * @return {Promise<void>}
   */
  async save() {
    checkUpdatesAllowed(this.schema);

    if (!this.hasUpdates()) {
      return;
    }

    // Track updatedAt change
    const previousUpdatedAt = this.record.updatedAt;
    const now = new Date().toISOString();
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

    // Apply watchers and persist through the collection
    const watched = this.collection.applyUpdateWatchers(this.record, updates);
    this.record = watched.record;
    await this.collection.updateByKeys(keys, watched.updates);
  }

  getUpdates() {
    return this.updates;
  }

  hasUpdates() {
    return Object.keys(this.updates).length > 0;
  }
}

export default PostgresPatcher;
