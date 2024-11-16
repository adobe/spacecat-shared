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

class BaseCollection {
  constructor(electroService, modelFactory, clazz, log) {
    this.electroService = electroService;
    this.modelFactory = modelFactory;
    this.clazz = clazz;
    this.entityName = this.clazz.name.toLowerCase();
    this.entity = electroService.entities[this.entityName];
    this.idName = `${this.entityName}Id`;
    this.log = log;
  }

  _createInstance(record) {
    if (!isNonEmptyObject(record?.data)) {
      return null;
    }
    // eslint-disable-next-line new-cap
    return new this.clazz(
      this.electroService,
      this.modelFactory,
      record.data,
      this.log,
    );
  }

  _createInstances(records) {
    if (!Array.isArray(records?.data)) {
      return [];
    }
    return records.data.map((record) => this._createInstance({ data: record }));
  }

  async findById(id) {
    if (!hasText(id)) {
      throw new Error('Id is required');
    }

    const record = await this.entity.get({ [this.idName]: id }).go();

    return this._createInstance(record);
  }

  async findByForeignKey(foreignKey, value) {
    try {
      const indexName = `by${foreignKey.charAt(0).toUpperCase() + foreignKey.slice(1)}`;
      const index = this.entity.query[indexName];

      if (!index) {
        throw new Error(`Index ${indexName} not found in ${this.entityName}`);
      }

      const results = await index({ [foreignKey]: value }).go();
      return results.data.map((record) => this._createInstance(record));
    } catch (error) {
      this.log.error(`Failed to find ${this.model.model.entity} by foreign key ${foreignKey}`, error);
      throw error;
    }
  }

  async create(data) {
    if (!isNonEmptyObject(data)) {
      throw new Error('Data is required');
    }

    try {
      const record = await this.entity.create(data).go();
      return this._createInstance(record);
    } catch (error) {
      this.log.error('Failed to create record', error);
      throw error;
    }
  }
}

export default BaseCollection;
