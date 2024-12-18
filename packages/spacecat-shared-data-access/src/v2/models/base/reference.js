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

import { hasText } from '@adobe/spacecat-shared-utils';
import {
  entityNameToCollectionName,
  entityNameToIdName,
  isNonEmptyArray,
  keyNamesToMethodName,
  referenceToBaseMethodName,
} from '../../util/util.js';

class Reference {
  static TYPES = {
    BELONGS_TO: 'belongs_to',
    HAS_MANY: 'has_many',
    HAS_ONE: 'has_one',
  };

  static fromJSON(json) {
    return new Reference(json.type, json.target, json.options);
  }

  static isValidType(type) {
    return Object.values(Reference.TYPES).includes(type);
  }

  constructor(type, target, options = {}) {
    if (!Reference.isValidType(type)) {
      throw new Error(`Invalid reference type: ${type}`);
    }

    if (!hasText(target)) {
      throw new Error('Invalid target');
    }

    this.type = type;
    this.target = target;
    this.options = options;
  }

  getSortKeys() {
    return this.options.sortKeys;
  }

  getTarget() {
    return this.target;
  }

  getType() {
    return this.type;
  }

  isRemoveDependents() {
    return this.options.removeDependents;
  }

  toAccessorConfigs(registry, entity) {
    const { log } = registry;
    const accessorConfigs = [];

    const target = this.getTarget();
    const type = this.getType();

    const baseMethodName = referenceToBaseMethodName(this);
    const collectionName = entityNameToCollectionName(target);
    const targetCollection = registry.getCollection(collectionName);

    switch (type) {
      case Reference.TYPES.BELONGS_TO: {
        const foreignKeyName = entityNameToIdName(target);
        const foreignKeyValue = entity.record[foreignKeyName];

        // belongs_to: direct findById
        accessorConfigs.push({
          name: baseMethodName,
          requiredKeys: [],
          foreignKey: { name: foreignKeyName, value: foreignKeyValue },
          byId: true,
        });
        break;
      }

      case Reference.TYPES.HAS_ONE: {
        const foreignKeyName = entityNameToIdName(entity.entityName);
        const foreignKeyValue = entity.getId();

        // has_one yields a single record.
        accessorConfigs.push({
          name: baseMethodName,
          requiredKeys: [],
          foreignKey: { name: foreignKeyName, value: foreignKeyValue },
        });
        break;
      }

      case Reference.TYPES.HAS_MANY: {
        const foreignKeyName = entityNameToIdName(entity.entityName);
        const foreignKeyValue = entity.getId();

        // has_many yields multiple records.
        accessorConfigs.push({
          name: baseMethodName,
          requiredKeys: [],
          all: true,
          foreignKey: { name: foreignKeyName, value: foreignKeyValue },
        });

        const belongsToRef = targetCollection.schema.getReferenceByTypeAndTarget(
          Reference.TYPES.BELONGS_TO,
          entity.schema.getModelName(),
        );

        if (!belongsToRef) {
          log.warn(`Reciprocal reference not found for ${entity.schema.getModelName()} to ${target}`);
          break;
        }

        const sortKeys = belongsToRef.getSortKeys();
        if (!isNonEmptyArray(sortKeys)) {
          log.debug(`No sort keys defined for ${entity.schema.getModelName()} to ${target}`);
          break;
        }

        const prefix = `${baseMethodName}By`;
        const targetIdName = entityNameToIdName(target);

        for (let i = 1; i <= sortKeys.length; i += 1) {
          const subset = sortKeys.slice(0, i);
          accessorConfigs.push({
            name: keyNamesToMethodName(subset, prefix, [targetIdName]),
            requiredKeys: subset,
            all: true,
            foreignKey: { name: foreignKeyName, value: foreignKeyValue },
          });
        }

        break;
      }

      default:
        throw new Error(`Unsupported reference type: ${type}`);
    }

    return accessorConfigs.map((config) => ({
      ...config,
      collection: targetCollection,
      context: entity,
    }));
  }
}

export default Reference;
