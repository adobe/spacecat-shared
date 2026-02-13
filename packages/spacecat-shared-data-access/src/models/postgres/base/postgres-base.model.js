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

import { isNonEmptyArray, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import BaseModel from '../../base/base.model.js';
import { DataAccessError } from '../../../errors/index.js';
import PostgresPatcher from '../../../util/postgres-patcher.js';

import Reference from '../../base/reference.js';

/**
 * PostgresBaseModel - A base class for representing individual entities backed
 * by PostgREST. Has the same public API as BaseModel but uses PostgresPatcher
 * for persistence instead of the ElectroDB-based Patcher.
 *
 * @class PostgresBaseModel
 * @extends BaseModel
 */
class PostgresBaseModel extends BaseModel {
  static ENTITY_NAME = undefined;

  /**
   * Constructs an instance of PostgresBaseModel.
   * @constructor
   * @param {Object} postgrestClient - The PostgREST client.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection.
   * @param {Schema} schema - The schema for the entity.
   * @param {Object} record - The initial data for the entity instance.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(postgrestClient, entityRegistry, schema, record, log) {
    // Wrap the postgrestClient with stubs so the parent BaseModel constructor
    // doesn't throw when accessing electroService.entities[entityName] and
    // when the v2 Patcher tries to access entity.model.
    /* c8 ignore next 7 -- stubs for parent constructor; replaced by PostgresPatcher */
    const entityStub = {
      model: { schema: { attributes: {} }, indexes: {} },
      patch: () => ({
        set: () => ({ go: async () => {} }),
        composite: () => ({ go: async () => {} }),
      }),
      remove: () => ({ go: async () => {} }),
    };
    const wrappedClient = Object.create(postgrestClient, {
      entities: {
        value: new Proxy({}, { get: () => entityStub }),
        writable: true,
        configurable: true,
      },
    });
    super(wrappedClient, entityRegistry, schema, record, log);

    this.postgrestClient = postgrestClient;

    // Replace the v2 Patcher with PostgresPatcher
    this.patcher = new PostgresPatcher(this.collection, this.schema, this.record);
  }

  /**
   * Internal remove method. Uses collection.removeByIndexKeys for deletion.
   * @return {Promise<PostgresBaseModel>}
   * @throws {DataAccessError}
   * @protected
   */
  async _remove() {
    try {
      const dependents = await this.#fetchDependents();

      /* c8 ignore next 12 -- only exercised with real entity hierarchies in Tasks 7-8 */
      const removePromises = dependents.map(async (dependent) => {
        try {
          // eslint-disable-next-line no-underscore-dangle
          await dependent._remove();
        } catch (e) {
          this.log.error(`Failed to remove dependent entity ${dependent.entityName} with ID ${dependent.getId()}`, e);
          throw new DataAccessError(
            `Failed to remove dependent entity ${dependent.entityName} with ID ${dependent.getId()}`,
            dependent,
            e,
          );
        }
      });

      await Promise.all(removePromises);

      await this.collection.removeByIndexKeys([this.generateCompositeKeys()]);

      this._accessorCache = {};

      return this;
    } catch (error) {
      /* c8 ignore next 8 -- DataAccessError is already thrown by removeByIndexKeys */
      if (error instanceof DataAccessError) {
        throw error;
      }
      this.log.error('Failed to remove record', error);
      throw new DataAccessError(
        `Failed to remove entity ${this.entityName} with ID ${this.getId()}`,
        this,
        error,
      );
    }
  }

  /**
   * Fetches dependent entities for cascade removal.
   * @return {Promise<Array>}
   * @private
   */
  /* c8 ignore next 32 -- only exercised with real entity hierarchies in Tasks 7-8 */
  async #fetchDependents() {
    const promises = [];

    const relationshipTypes = [
      Reference.TYPES.HAS_MANY,
      Reference.TYPES.HAS_ONE,
    ];

    relationshipTypes.forEach((type) => {
      const references = this.schema.getReferencesByType(type);
      const targets = references.filter((reference) => reference.isRemoveDependents());

      targets.forEach((reference) => {
        const accessors = reference.toAccessorConfigs(this.entityRegistry, this);
        const methodName = accessors[0].name;
        promises.push(
          this[methodName]()
            .then((dependent) => {
              if (isNonEmptyArray(dependent)) {
                return dependent;
              } else if (isNonEmptyObject(dependent)) {
                return [dependent];
              }

              return null;
            }),
        );
      });
    });

    const results = await Promise.all(promises);

    return results.flat().filter((dependent) => dependent !== null);
  }
}

export default PostgresBaseModel;
