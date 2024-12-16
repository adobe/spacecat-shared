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

import { hasText, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import {
  classExtends,
  entityNameToIdName,
  isPositiveInteger,
  modelNameToEntityName,
} from '../../util/util.js';

import BaseModel from './base.model.js';
import BaseCollection from './base.collection.js';

class Schema {
  /**
   * Constructs a new Schema instance.
   * @constructor
   * @param {BaseModel} modelClass - The class representing the model.
   * @param {BaseCollection} collectionClass - The class representing the model collection.
   * @param {object} rawSchema - The raw schema data.
   * @param {string} rawSchema.serviceName - The name of the service.
   * @param {number} rawSchema.schemaVersion - The version of the schema.
   * @param {object} rawSchema.attributes - The attributes of the schema.
   * @param {object} rawSchema.indexes - The indexes of the schema.
   * @param {Reference[]} [rawSchema.references] - The references of the schema.
   */
  constructor(
    modelClass,
    collectionClass,
    rawSchema,
  ) {
    this.modelClass = modelClass;
    this.collectionClass = collectionClass;

    this.serviceName = rawSchema.serviceName;
    this.schemaVersion = rawSchema.schemaVersion;
    this.attributes = rawSchema.attributes;
    this.indexes = rawSchema.indexes;
    this.references = rawSchema.references || [];

    this.#validateSchema();
  }

  #validateSchema() {
    if (!classExtends(this.modelClass, BaseModel)) {
      throw new Error('Model class must extend BaseModel');
    }

    if (!classExtends(this.collectionClass, BaseCollection)) {
      throw new Error('Collection class must extend BaseCollection');
    }

    if (!hasText(this.serviceName)) {
      throw new Error('Schema must have a service name');
    }

    if (!isPositiveInteger(this.schemaVersion)) {
      throw new Error('Schema version must be a positive integer');
    }

    if (!isNonEmptyObject(this.attributes)) {
      throw new Error('Schema must have attributes');
    }

    if (!isNonEmptyObject(this.indexes)) {
      throw new Error('Schema must have indexes');
    }

    if (!Array.isArray(this.references)) {
      throw new Error('References must be an array');
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  getAttributes() {
    return this.attributes;
  }

  getCollectionName() {
    return this.collectionClass.name;
  }

  getEntityName() {
    return modelNameToEntityName(this.getModelName());
  }

  getIdName() {
    return entityNameToIdName(this.getModelName());
  }

  getIndexByName(indexName) {
    return this.indexes[indexName];
  }

  /**
   * Returns the indexes for the schema. By default, this returns all indexes.
   * You can use the `exclude` parameter to exclude certain indexes.
   * @param {Array<string>} [exclude] - One of the INDEX_TYPES values.
   * @return {object} The indexes.
   */
  getIndexes(exclude) {
    if (!Array.isArray(exclude)) {
      return this.indexes;
    }

    return Object.keys(this.indexes).reduce((acc, indexName) => {
      const index = this.indexes[indexName];

      if (!exclude.includes(indexName)) {
        acc[indexName] = index;
      }

      return acc;
    }, {});
  }

  getIndexKeys(indexName) {
    const index = this.getIndexByName(indexName);

    if (!isNonEmptyObject(index)) {
      return [];
    }

    const pkKeys = Array.isArray(index.pk?.facets) ? index.pk.facets : [];
    const skKeys = Array.isArray(index.sk?.facets) ? index.sk.facets : [index.sk?.field];

    return [...pkKeys, ...skKeys];
  }

  getModelClass() {
    return this.modelClass;
  }

  getModelName() {
    return this.modelClass.name;
  }

  getReferences() {
    return this.references;
  }

  getReferencesByType(type) {
    return this.references.filter((ref) => ref.type === type);
  }

  getReferenceByTypeAndTarget(type, target) {
    return this.references.find((ref) => ref.type === type && ref.target === target);
  }

  getServiceName() {
    return this.serviceName;
  }

  getVersion() {
    return this.schemaVersion;
  }

  /**
   * Transforms the stored schema model into a format directly usable by ElectroDB.
   * Here, you could do any final adjustments or transformations needed before returning.
   *
   * @returns {object} ElectroDB-compatible schema.
   */
  toElectroDBSchema() {
    return {
      model: {
        entity: this.getModelName(),
        version: String(this.getVersion()),
        service: this.getServiceName(),
      },
      attributes: this.attributes,
      indexes: this.indexes,
    };
  }
}

export default Schema;
