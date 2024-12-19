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

import { hasText, isInteger, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import { v4 as uuid, validate as uuidValidate } from 'uuid';

import {
  decapitalize,
  entityNameToAllPKValue,
  entityNameToIdName,
  isNonEmptyArray,
} from '../../util/util.js';

import { INDEX_TYPES } from './constants.js';
import BaseModel from './base.model.js';
import BaseCollection from './base.collection.js';
import Reference from './reference.js';
import Schema from './schema.js';

const DEFAULT_SERVICE_NAME = 'SpaceCat';

/**
 * ID attribute configuration object.
 * Ensures a UUID-based "primary key".
 * @type {object}
 */
const ID_ATTRIBUTE_DATA = {
  type: 'string',
  required: true,
  readOnly: true,
  // https://electrodb.dev/en/modeling/attributes/#default
  default: () => uuid(),
  // https://electrodb.dev/en/modeling/attributes/#attribute-validation
  validate: (value) => uuidValidate(value),
};

/**
 * CreatedAt attribute configuration object.
 * Automatically sets to current date/time at creation.
 * @type {object}
 */
const CREATED_AT_ATTRIBUTE_DATA = {
  type: 'string',
  readOnly: true,
  required: true,
  default: () => new Date().toISOString(),
};

/**
 * UpdatedAt attribute configuration object.
 * Automatically updates to current date/time whenever the entity is modified.
 * @type {object}
 */
const UPDATED_AT_ATTRIBUTE_DATA = {
  type: 'string',
  required: true,
  readOnly: true,
  watch: '*',
  default: () => new Date().toISOString(),
  set: () => new Date().toISOString(),
};

/**
 * The SchemaBuilder class allows for constructing a schema definition
 * including attributes, indexes, and references to other entities.
 * Index ordering is enforced at build time for deterministic output:
 *  - primary index first
 *  - "all" index second (if present)
 *  - all "belongs_to" indexes sorted alphabetically next
 *  - all "other" indexes sorted alphabetically last
 */
class SchemaBuilder {
  /**
   * Creates a new SchemaBuilder instance.
   *
   * @param {BaseModel} modelClass - The model class for this entity.
   * @param {BaseCollection} collectionClass - The collection class for this entity.
   * @param {number} schemaVersion - A positive integer representing the schema's version.
   * @throws {Error} If entityName is not a non-empty string.
   * @throws {Error} If schemaVersion is not a positive integer.
   * @throws {Error} If serviceName is not a non-empty string.
   */
  constructor(modelClass, collectionClass, schemaVersion = 1) {
    if (!modelClass || !(modelClass.prototype instanceof BaseModel)) {
      throw new Error('modelClass must be a subclass of BaseModel.');
    }

    if (!collectionClass || !(collectionClass.prototype instanceof BaseCollection)) {
      throw new Error('collectionClass must be a subclass of BaseCollection.');
    }

    if (!isInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error('schemaVersion is required and must be a positive integer.');
    }

    this.modelClass = modelClass;
    this.collectionClass = collectionClass;
    this.schemaVersion = schemaVersion;
    this.entityName = modelClass.name;
    this.serviceName = DEFAULT_SERVICE_NAME;

    this.idName = entityNameToIdName(this.entityName);

    this.rawIndexes = {
      primary: null,
      all: [],
      belongs_to: [],
      other: [],
    };

    this.attributes = {};

    // will be populated by build() from rawIndexes
    this.indexes = {};

    // this is not part of the ElectroDB schema spec, but we use it to store reference data
    this.references = [];

    this.#initialize();
  }

  #initialize() {
    this.addAttribute(this.idName, ID_ATTRIBUTE_DATA);
    this.addAttribute('createdAt', CREATED_AT_ATTRIBUTE_DATA);
    this.addAttribute('updatedAt', UPDATED_AT_ATTRIBUTE_DATA);
    // todo: add createdBy, updatedBy and auto-set from auth context

    // set up the primary index directly
    // primary index fields are fixed and known upfront
    this.rawIndexes.primary = {
      pk: { field: 'pk', composite: [this.idName] },
      sk: { field: 'sk', composite: [] },
    };
  }

  #internalAddIndex(partitionKey, sortKey, type) {
    // store index config without assigning fields yet
    // the fields will be assigned in build phase based on sorting and presence of "all" index
    this.rawIndexes[type].push({
      type,
      pk: { ...partitionKey },
      sk: { ...sortKey },
    });
  }

  /**
   * Adds a new attribute to the schema definition.
   *
   * @param {string} name - The attribute name.
   * @param {object} data - The attribute definition (type, required, validation, etc.).
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If name is not non-empty or data is not an object.
   */
  addAttribute(name, data) {
    if (!hasText(name)) {
      throw new Error('Attribute name is required and must be non-empty.');
    }

    if (!isNonEmptyObject(data)) {
      throw new Error(`Attribute data for "${name}" is required and must be a non-empty object.`);
    }

    this.attributes[name] = data;

    return this;
  }

  /**
   * Adds an "all" index with composite partition and sort keys, or a template-based sort key.
   * Useful for querying all entities of this type. Only one "all" index is allowed and a
   * pre-existing "all" index will be overwritten.
   *
   * @param {Array<string>} sortKeys - The attributes to form the sort key.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If composite attribute names or template are not provided.
   */
  addAllIndex(sortKeys) {
    if (!isNonEmptyArray(sortKeys)) {
      throw new Error('Sort keys are required and must be a non-empty array.');
    }

    this.#internalAddIndex(
      { template: entityNameToAllPKValue(this.entityName) },
      { composite: sortKeys },
      INDEX_TYPES.ALL,
    );

    return this;
  }

  /**
   * Adds a generic secondary index (GSI).
   *
   * @param {object} partitionKey - The partition key definition
   * (e.g., { composite: [attributeName] }).
   * @param {object} sortKey - The sort key definition.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If index name is reserved or pk/sk configs are invalid.
   */
  addIndex(partitionKey, sortKey) {
    if (!isNonEmptyObject(partitionKey)) {
      throw new Error('Partition key configuration (pk) is required and must be a non-empty object.');
    }

    if (!isNonEmptyObject(sortKey)) {
      throw new Error('Sort key configuration (sk) is required and must be a non-empty object.');
    }

    this.#internalAddIndex(partitionKey, sortKey, INDEX_TYPES.OTHER);

    return this;
  }

  /**
   * Adds a reference to another entity, potentially creating a belongs_to index.
   *
   * @param {string} type - One of Reference.TYPES (BELONGS_TO, HAS_MANY, HAS_ONE).
   * @param {string} entityName - The referenced entity name.
   * @param {Array<string>} [sortKeys=['updatedAt']] - The attributes to form the sort key.
   * @param {object} [options] - Additional reference options.
   * @param {boolean} [options.required=true] - Whether the reference is required. Only applies to
   * BELONGS_TO references.
   * @param {boolean} [options.removeDependents=false] - Whether to remove dependent entities
   * on delete. Only applies to HAS_MANY and HAS_ONE references.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If type or entityName are invalid.
   */
  addReference(type, entityName, sortKeys = [], options = {}) {
    if (!Reference.isValidType(type)) {
      throw new Error(`Invalid referenceType: "${type}".`);
    }

    if (!hasText(entityName)) {
      throw new Error('entityName for reference is required and must be a non-empty string.');
    }
    const reference = {
      type,
      target: entityName,
      options: { sortKeys },
    };

    if ([
      Reference.TYPES.HAS_MANY,
      Reference.TYPES.HAS_ONE,
    ].includes(type)) {
      reference.options.removeDependents = options.removeDependents ?? false;
    }

    if (type === Reference.TYPES.BELONGS_TO) {
      reference.options.required = options.required ?? true;

      // for a BELONGS_TO reference, we add a foreign key attribute
      // and a corresponding "belongs_to" index to facilitate lookups by that foreign key.
      const foreignKeyName = entityNameToIdName(entityName);

      this.addAttribute(foreignKeyName, {
        type: 'string',
        required: reference.options.required,
        validate: (
          value,
        ) => (reference.options.required ? uuidValidate(value) : !value || uuidValidate(value)),
      });

      this.#internalAddIndex(
        { composite: [decapitalize(foreignKeyName)] },
        { composite: isNonEmptyArray(sortKeys) ? sortKeys : ['updatedAt'] },
        INDEX_TYPES.BELONGS_TO,
      );
    }

    this.references.push(Reference.fromJSON(reference));

    return this;
  }

  /**
   * Builds the final indexes object by:
   *  - Sorting and merging belongs_to and other indexes
   *  - Assigning GSI fields to indexes after final order is determined
   *
   * @private
   */
  #buildIndexes() {
    // eslint-disable-next-line camelcase
    const { all, belongs_to, other } = this.rawIndexes;

    // set the order of indexes
    const orderedIndexes = [
      ...all,
      // eslint-disable-next-line camelcase
      ...belongs_to,
      ...other,
    ];

    if (orderedIndexes.length > 5) {
      throw new Error('Cannot have more than 5 indexes.');
    }

    this.indexes = { primary: this.rawIndexes.primary };

    let indexCounter = 0;
    Object.values(orderedIndexes).forEach((index) => { /* eslint-disable no-param-reassign */
      indexCounter += 1;

      const pkFieldName = `gsi${indexCounter}pk`;
      const skFieldName = `gsi${indexCounter}sk`;
      const indexName = `${this.serviceName.toLowerCase()}-data-${pkFieldName}-${skFieldName}`;

      this.indexes[indexName] = {
        index: indexName,
        indexType: index.type,
        pk: { field: pkFieldName, ...index.pk },
        sk: { field: skFieldName, ...index.sk },
      };
    });
  }

  /**
   * Finalizes the schema by building and ordering indexes.
   *
   * @returns {object} The fully constructed schema object.
   */
  build() {
    this.#buildIndexes();

    return new Schema(
      this.modelClass,
      this.collectionClass,
      {
        serviceName: this.serviceName,
        schemaVersion: this.schemaVersion,
        attributes: this.attributes,
        indexes: this.indexes,
        references: this.references,
      },
    );
  }
}

export default SchemaBuilder;
