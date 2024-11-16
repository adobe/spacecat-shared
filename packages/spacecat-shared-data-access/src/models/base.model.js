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

import Patcher from '../util/patcher.js';

class Base {
  constructor(electroService, modelFactory, record, log) {
    this.modelFactory = modelFactory;
    this.record = record;
    this.entityName = this.constructor.name.toLowerCase();
    this.entity = electroService.entities[this.entityName];
    this.idName = `${this.entityName}Id`;
    this.log = log;

    this.patcher = new Patcher(this.entity, this.record);
    this.associationsCache = {};
  }

  async _getAssociation(modelName, method, ...args) {
    const cache = this.associationsCache;

    cache[modelName] = cache[modelName] || {};

    if (!(method in cache[modelName])) {
      cache[modelName][method] = this.modelFactory.getCollection(modelName)[method](...args);
    }

    return cache[modelName][method];
  }

  getId() {
    return this.record[this.idName];
  }

  getCreatedAt() {
    return new Date(this.record.createdAt).toISOString();
  }

  getUpdatedAt() {
    return new Date(this.record.updatedAt).toISOString();
  }

  async remove() {
    try {
      await this.entity.remove({ [this.idName]: this.getId() }).go();
      return this;
    } catch (error) {
      this.log.error('Failed to remove record', error);
      throw error;
    }
  }

  async save() {
    try {
      await this.patcher.save();
      return this;
    } catch (error) {
      this.log.error('Failed to save record', error);
      throw error;
    }
  }
}

export default Base;
