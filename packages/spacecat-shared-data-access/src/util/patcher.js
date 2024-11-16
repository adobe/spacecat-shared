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

import {
  guardArray,
  guardEnum,
  guardId,
  guardMap,
  guardNumber,
  guardString,
} from './guards.js';

class Patcher {
  constructor(entity, record) {
    this.entity = entity;
    this.entityName = this.entity.model.name.toLowerCase();
    this.model = entity.model;
    this.idName = `${this.model.name.toLowerCase()}Id`;
    this.record = record;

    this.patchRecord = null;
  }

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

  #set(propertyName, value) {
    // if a property is part of a composite key, we need to update the composite key as well
    // https://electrodb.dev/en/reference/errors/#missing-composite-attributes
    // https://github.com/tywalch/electrodb/issues/406
    const compositeValues = this.#getCompositeValuesForKey(this.record, propertyName);
    this.patchRecord = this.getPatchRecord().set({
      ...compositeValues,
      [propertyName]: value,
    });
    this.record[propertyName] = value;
  }

  getPatchRecord() {
    if (!this.patchRecord) {
      this.patchRecord = this.entity.patch({ [this.idName]: this.record[this.idName] });
    }
    return this.patchRecord;
  }

  patchString(propertyName, value) {
    guardString(propertyName, value, this.entityName);

    this.#set(propertyName, value);
  }

  patchEnum(propertyName, value) {
    guardEnum(
      propertyName,
      value,
      this.model.schema.attributes[propertyName].enumArray,
      this.entityName,
    );

    this.#set(propertyName, value);
  }

  patchId(propertyName, value) {
    guardId(propertyName, value, this.entityName);

    this.#set(propertyName, value);
  }

  patchMap(propertyName, value) {
    guardMap(propertyName, value, this.entityName);

    this.#set(propertyName, value);
  }

  patchNumber(propertyName, value) {
    guardNumber(propertyName, value, this.entityName);

    this.#set(propertyName, value);
  }

  patchSet(propertyName, value) {
    guardArray(propertyName, value, this.entityName);

    this.#set(propertyName, value);
  }

  async save() {
    await this.getPatchRecord().go();
    this.record.updatedAt = new Date().getTime();
  }
}

export default Patcher;
