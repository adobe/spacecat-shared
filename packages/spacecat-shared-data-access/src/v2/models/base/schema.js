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

import { entityNameToIdName, modelNameToEntityName } from '../../util/util.js';

class Schema {
  static INDEX_TYPES = {
    PRIMARY: 'primary',
    ALL: 'all',
    BELONGS_TO: 'belongs_to',
    OTHER: 'other',
  };

  static REFERENCE_TYPES = {
    BELONGS_TO: 'belongs_to',
    HAS_MANY: 'has_many',
    HAS_ONE: 'has_one',
  };

  /**
   * Constructs a new Schema instance.
   * @constructor
   * @param {BaseModel} modelClass - The class representing the model.
   * @param {BaseCollection} collectionClass - The class representing the model collection.
   * @param {object} model - The ElectroDB model definition (entity, version, service).
   * @param {object} attributes - The attributes definition.
   * @param {object} indexes - The indexes definition.
   * @param {object} references - The custom references object.
   */
  constructor(
    modelClass,
    collectionClass,
    model,
    attributes,
    indexes,
    references,
  ) {
    this.modelClass = modelClass;
    this.collectionClass = collectionClass;
    this.model = model;
    this.attributes = attributes;
    this.indexes = indexes;
    this.references = references;
  }

  getAttributes() {
    return this.attributes;
  }

  getEntityName() {
    return modelNameToEntityName(this.model.entity);
  }

  getIdName() {
    return entityNameToIdName(this.model.entity);
  }

  getIndexes() {
    return this.indexes;
  }

  getModelClass() {
    return this.modelClass;
  }

  getCollectionName() {
    return this.collectionClass.name;
  }

  /**
   * Return the raw references data for internal usage (e.g., in models/collections).
   */
  getReferences() {
    return this.references;
  }

  /**
   * Transforms the stored schema model into a format directly usable by ElectroDB.
   * Here, you could do any final adjustments or transformations needed before returning.
   *
   * @returns {object} ElectroDB-compatible schema.
   */
  toElectroDBSchema() {
    return {
      model: this.model,
      attributes: this.attributes,
      indexes: this.indexes,
      // ElectroDB doesn't require "references", but we keep them here for our app logic.
      // We might store them separately or just not include them in the returned object.
    };
  }
}

export default Schema;
