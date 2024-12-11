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
  capitalize,
  decapitalize,
  entityNameToAllPKValue,
  entityNameToIdName,
} from '../../util/util.js';

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

export const INDEX_TYPES = {
  PRIMARY: 'primary',
  ALL: 'all',
  BELONGS_TO: 'belongs_to',
  OTHER: 'other',
};

/** Certain index names (primary, all) are reserved and cannot be reused. */
const RESERVED_INDEX_NAMES = [INDEX_TYPES.PRIMARY, INDEX_TYPES.ALL];

/**
 * Constructs a fully qualified index name.
 * @param {string} service - The name of the service.
 * @param {string} entity - The name of the entity.
 * @param {string} name - The index name (e.g., 'all', 'byForeignKey').
 * @returns {string} The fully qualified index name.
 */
const createdIndexName = (service, entity, name) => `${service.toLowerCase()}-data-${entity}-${name}`;

/**
 * Sorts an indexes object by its keys alphabetically.
 * @param {object} indexes - An object whose keys are index names and values are index definitions.
 * @returns {object} A new object with the same entries, but keys sorted alphabetically.
 */
const sortIndexes = (indexes) => Object.fromEntries(
  Object.entries(indexes).sort((a, b) => a[0].localeCompare(b[0])),
);

/**
 * Assigns GSI field names to indexes that don't have them yet.
 * Ensures that if an "all" index exists, it uses gsi1 (already assigned)
 * and other indexes continue numbering from gsi2 onwards.
 *
 * @param {object} indexes - Object of indexes that require naming.
 * @param {object|null} all - The "all" index object if present, null otherwise.
 */
const numberGSIsIndexes = (indexes, all) => {
  // if there's an "all" index, we start indexing subsequent GSIs from 2,
  // because "all" index already occupies gsi1.
  // if no "all" index exists, start from 1.
  let gsiCounter = isNonEmptyObject(all) ? 1 : 0;

  Object.values(indexes).forEach((index) => { /* eslint-disable no-param-reassign */
    // only assign new field names and number through if none are provided.
    if (!index.pk.field || !index.sk.field) {
      gsiCounter += 1;
    }

    index.pk.field = index.pk.field || `gsi${gsiCounter}pk`;
    index.sk.field = index.sk.field || `gsi${gsiCounter}sk`;
  });
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
  static REFERENCE_TYPES = {
    BELONGS_TO: 'belongs_to',
    HAS_MANY: 'has_many',
    HAS_ONE: 'has_one',
  };

  /**
   * Creates a new SchemaBuilder instance.
   *
   * @param {string} entityName - The name of the entity to be modeled.
   * @param {number} schemaVersion - A positive integer representing the schema's version.
   * @param {string} serviceName - The name of the service to which this entity belongs.
   * @throws {Error} If entityName is not a non-empty string.
   * @throws {Error} If schemaVersion is not a positive integer.
   * @throws {Error} If serviceName is not a non-empty string.
   */
  constructor(entityName, schemaVersion, serviceName) {
    if (!hasText(entityName)) {
      throw new Error('entityName is required and must be a non-empty string.');
    }

    if (!isInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error('schemaVersion is required and must be a positive integer.');
    }

    if (!hasText(serviceName)) {
      throw new Error('serviceName is required and must be a non-empty string.');
    }

    this.entityName = entityName;
    this.idName = entityNameToIdName(entityName);
    this.serviceName = serviceName;

    this.rawIndexes = {
      primary: null,
      all: null,
      belongs_to: {},
      other: {},
    };

    this.schema = {
      model: {
        entity: entityName,
        version: String(schemaVersion),
        service: serviceName,
      },
      attributes: {},
      indexes: {}, // will be populated by build() from rawIndexes
      references: { belongs_to: [], has_many: [], has_one: [] },
    };

    this.#initialize();
  }

  #internalAddIndex(name, partitionKey, sortKey, type) {
    const indexFullName = createdIndexName(this.serviceName, this.entityName, name);

    // store index config without assigning fields yet
    // the fields will be assigned in build phase based on sorting and presence of "all" index
    this.rawIndexes[type][name] = {
      ...(indexFullName && { index: indexFullName }),
      pk: { ...partitionKey },
      sk: { ...sortKey },
    };
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

    this.schema.attributes[name] = data;

    return this;
  }

  /**
   * Adds an "all" index based on composite attributes.
   * The "all" index is a special index listing all entities, sorted by given attributes.
   * Useful for global queries across all entities of this type.
   * Will overwrite any existing "all" index.
   *
   * @param {...string} attributeNames - The attribute names forming the composite sort key.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If no attribute names are provided.
   */
  addAllIndexWithComposite(...attributeNames) {
    if (attributeNames.length === 0) {
      throw new Error('At least one composite attribute name is required.');
    }

    this.rawIndexes.all = {
      index: createdIndexName(this.serviceName, this.entityName, INDEX_TYPES.ALL),
      pk: { field: 'gsi1pk', template: entityNameToAllPKValue(this.entityName) },
      sk: { field: 'gsi1sk', composite: attributeNames },
    };

    return this;
  }

  /**
   * Adds an "all" index with a template-based sort key.
   * Useful if a single value template defines how entries are sorted.
   *
   * @param {string} fieldName - The sort key field name.
   * @param {string} template - A template string defining how to generate the sort key value.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If fieldName or template are not valid strings.
   */
  addAllIndexWithTemplateField(fieldName, template) {
    if (!hasText(fieldName)) {
      throw new Error('fieldName is required and must be a non-empty string.');
    }

    if (!hasText(template)) {
      throw new Error('template is required and must be a non-empty string.');
    }

    this.rawIndexes.all = {
      index: createdIndexName(this.serviceName, this.entityName, 'all'),
      pk: { field: 'gsi1pk', template: entityNameToAllPKValue(this.entityName) },
      sk: { field: fieldName, template },
    };

    return this;
  }

  /**
   * Adds a generic secondary index (GSI).
   *
   * @param {string} name - The index name. Cannot be 'primary' or 'all'.
   * @param {object} partitionKey - The partition key definition
   * (e.g., { composite: [attributeName] }).
   * @param {object} sortKey - The sort key definition.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If index name is reserved or pk/sk configs are invalid.
   */
  addIndex(name, partitionKey, sortKey) {
    if (!hasText(name)) {
      throw new Error('Index name is required and must be a non-empty string.');
    }

    if (RESERVED_INDEX_NAMES.includes(name)) {
      throw new Error(`Index name "${name}" is reserved.`);
    }

    if (!isNonEmptyObject(partitionKey)) {
      throw new Error('Partition key configuration (pk) is required and must be a non-empty object.');
    }

    if (!isNonEmptyObject(sortKey)) {
      throw new Error('Sort key configuration (sk) is required and must be a non-empty object.');
    }

    this.#internalAddIndex(name, partitionKey, sortKey, INDEX_TYPES.OTHER);

    return this;
  }

  /**
   * Adds a reference to another entity, potentially creating a belongs_to index.
   *
   * @param {string} referenceType - One of 'belongs_to', 'has_many', or 'has_one'.
   * @param {string} entityName - The referenced entity name.
   * @param {Array<string>} [sortKeys=['updatedAt']] - The attributes to form the sort key.
   * @param {boolean} [required=true] - Whether the foreign key is required.
   * @returns {SchemaBuilder} Returns this builder for method chaining.
   * @throws {Error} If referenceType or entityName are invalid.
   */
  addReference(referenceType, entityName, sortKeys = ['updatedAt'], required = true) {
    if (!Object.values(SchemaBuilder.REFERENCE_TYPES).includes(referenceType)) {
      throw new Error(`Invalid referenceType: "${referenceType}".`);
    }

    if (!hasText(entityName)) {
      throw new Error('entityName for reference is required and must be a non-empty string.');
    }

    this.schema.references[referenceType].push({ target: entityName });

    if (referenceType !== SchemaBuilder.REFERENCE_TYPES.BELONGS_TO) {
      return this;
    }

    // for a BELONGS_TO reference, we add a foreign key attribute
    // and a corresponding "belongs_to" index to facilitate lookups by that foreign key.
    const foreignKeyName = entityNameToIdName(entityName);

    this.addAttribute(foreignKeyName, {
      type: 'string',
      required,
      validate: (value) => (required ? uuidValidate(value) : !value || uuidValidate(value)),
    });

    this.#internalAddIndex(
      `by${capitalize(foreignKeyName)}`,
      { composite: [decapitalize(foreignKeyName)] },
      { composite: sortKeys },
      INDEX_TYPES.BELONGS_TO,
    );

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
    const { belongs_to, other } = this.rawIndexes;

    // belongs_to indexes come before other indexes
    const indexes = {
      ...sortIndexes(belongs_to),
      ...sortIndexes(other),
    };

    numberGSIsIndexes(indexes, this.rawIndexes.all);

    this.schema.indexes = {
      primary: this.rawIndexes.primary,
      ...(this.rawIndexes.all && { all: this.rawIndexes.all }),
      ...indexes,
    };
  }

  /**
   * Finalizes the schema by building and ordering indexes.
   *
   * @returns {object} The fully constructed schema object.
   */
  build() {
    this.#buildIndexes();

    return this.schema;
  }
}

export default SchemaBuilder;
