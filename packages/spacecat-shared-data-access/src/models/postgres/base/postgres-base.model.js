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
 * Creates a Proxy-based electroService stub for the parent BaseModel constructor.
 * The parent constructor reads `electroService.entities[entityName]` and passes the
 * result to the v2 Patcher constructor, which reads `entity.model`. All other entity
 * property access throws a descriptive DataAccessError. The Patcher created during
 * super() is immediately replaced by PostgresPatcher.
 *
 * @param {string} entityName - The entity name from the schema.
 * @returns {Proxy} A Proxy that provides `entities[entityName]` for the parent constructor.
 */
function createElectroServiceProxy(entityName) {
  // The v2 Patcher constructor reads entity.model (and stores it).
  // Provide the minimum needed so it doesn't throw during super().
  // The Patcher is replaced by PostgresPatcher immediately after.
  const ALLOWED_ENTITY_PROPS = {
    model: { schema: { attributes: {} }, indexes: {} },
  };

  const entityProxy = new Proxy({}, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop in ALLOWED_ENTITY_PROPS) return ALLOWED_ENTITY_PROPS[prop];
      throw new DataAccessError(
        `[PostgresBaseModel] Attempted to access entity.${String(prop)} `
        + `for '${entityName}'. This is an ElectroDB property not available in the Postgres backend. `
        + 'Ensure the calling method is overridden in PostgresBaseModel.',
      );
    },
  });

  return new Proxy({}, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'entities') {
        return { [entityName]: entityProxy };
      }
      throw new DataAccessError(
        `[PostgresBaseModel] Attempted to access electroService.${String(prop)} `
        + `for '${entityName}'. The Postgres backend does not use ElectroDB.`,
      );
    },
  });
}

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
    // Create a Proxy-based electroService stub for the parent constructor.
    // The parent reads electroService.entities[entityName] and passes it to the
    // v2 Patcher (which reads entity.model). All other access throws. The Patcher
    // is immediately replaced by PostgresPatcher after super().
    const electroServiceProxy = createElectroServiceProxy(schema.getEntityName());
    super(electroServiceProxy, entityRegistry, schema, record, log);

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
