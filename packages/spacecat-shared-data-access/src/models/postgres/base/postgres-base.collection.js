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

import {
  hasText,
  isNonEmptyArray,
  isNonEmptyObject,
  isObject,
} from '@adobe/spacecat-shared-utils';

import BaseCollection from '../../base/base.collection.js';
import DataAccessError from '../../../errors/data-access.error.js';
import ValidationError from '../../../errors/validation.error.js';
import { guardId, guardArray } from '../../../util/guards.js';
import {
  applyWhere,
  createFieldMaps,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  entityToTableName,
  fromDbRecord,
  toDbField,
  toDbRecord,
} from '../../../util/postgrest.utils.js';

/* c8 ignore next 8 -- only exercised with real entity hierarchies in Tasks 7-8 */
function isValidParent(parent, child) {
  if (!hasText(parent.entityName)) {
    return false;
  }

  const foreignKey = `${parent.entityName}Id`;
  return child.record?.[foreignKey] === parent.record?.[foreignKey];
}

/**
 * PostgresBaseCollection - A base class for managing collections of entities
 * backed by PostgREST. Has the same public API as BaseCollection but uses
 * PostgREST queries instead of ElectroDB/DynamoDB.
 *
 * @class PostgresBaseCollection
 * @extends BaseCollection
 */
class PostgresBaseCollection extends BaseCollection {
  static COLLECTION_NAME = undefined;

  /**
   * Constructs an instance of PostgresBaseCollection.
   * @constructor
   * @param {Object} postgrestClient - The PostgREST client for database operations.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection.
   * @param {Object} schema - The schema for the entity.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(postgrestClient, entityRegistry, schema, log) {
    // Wrap the postgrestClient with an `entities` stub so the parent BaseCollection
    // constructor doesn't throw when accessing electroService.entities[entityName].
    // We override all methods, so the ElectroDB code paths are never used.
    const wrappedClient = Object.create(postgrestClient, {
      entities: { value: {}, writable: true, configurable: true },
    });
    super(wrappedClient, entityRegistry, schema, log);

    this.postgrestClient = postgrestClient;
    this.tableName = entityToTableName(this.schema.getModelName());
    this.fieldMaps = createFieldMaps(this.schema);
  }

  // --- Private helpers ---

  #logAndThrowError(message, cause) {
    const error = new DataAccessError(message, this, cause);
    this.log.error(`Postgres Collection Error [${this.entityName}]`, error);
    /* c8 ignore next 3 -- PostgREST errors with fields are rare in unit tests */
    if (isNonEmptyArray(error.cause?.fields)) {
      this.log.error(`Validation errors: ${JSON.stringify(error.cause.fields)}`);
    }
    throw error;
  }

  #toDbField(field) {
    return toDbField(field, this.fieldMaps.toDbMap);
  }

  #toDbRecord(record) {
    return toDbRecord(record, this.fieldMaps.toDbMap);
  }

  #toModelRecord(record) {
    return fromDbRecord(record, this.fieldMaps.toModelMap);
  }

  #buildSelect(attributes) {
    if (!isNonEmptyArray(attributes)) {
      return '*';
    }
    return attributes.map((field) => this.#toDbField(field)).join(',');
  }

  #getOrderField(indexName, keys) {
    if (hasText(indexName)) {
      const indexKeys = this.schema.getIndexKeys(indexName);
      if (isNonEmptyArray(indexKeys)) {
        return this.#toDbField(indexKeys[indexKeys.length - 1]);
      }
    }
    /* c8 ignore next 5 -- fallback for schemas with empty index keys */

    const keyNames = Object.keys(keys);
    const defaultSortField = isNonEmptyArray(keyNames)
      ? keyNames[keyNames.length - 1]
      : 'updatedAt';
    return this.#toDbField(defaultSortField);
  }

  #createInstance(record) {
    /* c8 ignore next 4 -- defensive: PostgREST always returns full records */
    if (!isNonEmptyObject(record)) {
      this.log.warn(`Failed to create instance of [${this.entityName}]: record is empty`);
      return null;
    }

    const ModelClass = this.schema.getModelClass();
    // eslint-disable-next-line new-cap
    return new ModelClass(
      this.postgrestClient,
      this.entityRegistry,
      this.schema,
      record,
      this.log,
    );
  }

  #createInstances(records) {
    return records
      .map((record) => this.#createInstance(record))
      .filter((instance) => instance !== null);
  }

  #invalidateCache() {
    this._accessorCache = {};
  }

  #applyDefaults(record) {
    const nextRecord = { ...record };
    const attributes = this.schema.getAttributes();
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (nextRecord[name] !== undefined || attribute.default === undefined) {
        return;
      }

      nextRecord[name] = typeof attribute.default === 'function'
        ? attribute.default()
        : attribute.default;
    });
    return nextRecord;
  }

  #applySetters(record) {
    const nextRecord = { ...record };
    const attributes = this.schema.getAttributes();
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (typeof attribute.set !== 'function') {
        return;
      }

      const value = attribute.set(nextRecord[name], nextRecord);
      if (value !== undefined) {
        nextRecord[name] = value;
      }
    });
    return nextRecord;
  }

  #validateItem(item) {
    const attributes = this.schema.getAttributes();
    const errors = [];

    Object.entries(attributes).forEach(([name, attribute]) => {
      const value = item[name];

      if (attribute.required && (value === undefined || value === null)) {
        errors.push(`${name} is required`);
        return;
      }

      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(attribute.type) && !attribute.type.includes(value)) {
        errors.push(`${name} is invalid`);
      } else if (attribute.type === 'string' && typeof value !== 'string') {
        errors.push(`${name} must be a string`);
      } else if (attribute.type === 'number' && typeof value !== 'number') {
        errors.push(`${name} must be a number`);
      } else if (attribute.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${name} must be a boolean`);
      } else if (attribute.type === 'list' && !Array.isArray(value)) {
        errors.push(`${name} must be a list`);
      } else if (attribute.type === 'map' && !isObject(value)) {
        errors.push(`${name} must be a map`);
      }

      if (typeof attribute.validate === 'function') {
        try {
          const result = attribute.validate(value, item);
          if (result === false) {
            errors.push(`${name} failed validation`);
          }
        } catch (e) {
          errors.push(`${name} failed validation`);
        }
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '), this);
    }
  }

  #prepareItem(item) {
    let prepared = { ...item };
    prepared = this.#applyDefaults(prepared);
    prepared = this.#applySetters(prepared);
    this.#validateItem(prepared);
    return prepared;
  }

  #applyKeyFilters(query, keys) {
    let filtered = query;
    Object.entries(keys).forEach(([key, value]) => {
      filtered = filtered.eq(this.#toDbField(key), value);
    });
    return filtered;
  }

  async #queryPage({
    keys,
    options,
    offset,
    limit,
  }) {
    const select = this.#buildSelect(options.attributes);
    const indexName = options.index || this.schema.findIndexNameByKeys(keys);
    const index = this.schema.getIndexByName(indexName);
    if (options.index && !index) {
      this.#logAndThrowError(`Failed to query [${this.entityName}]: query proxy [${options.index}] not found`);
    }

    const orderField = this.#getOrderField(indexName, keys);
    let query = this.postgrestClient
      .from(this.tableName)
      .select(select)
      .order(orderField, { ascending: options.order === 'asc' });

    query = this.#applyKeyFilters(query, keys);
    if (isObject(options.between)) {
      const betweenField = this.#toDbField(options.between.attribute);
      query = query.gte(betweenField, options.between.start).lte(betweenField, options.between.end);
    }
    query = applyWhere(query, options.where, this.fieldMaps.toDbMap);

    const pageSize = Number.isInteger(limit) ? limit : DEFAULT_PAGE_SIZE;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error } = await query;
    if (error) {
      this.#logAndThrowError('Failed to query', error);
    }

    return (data || []).map((record) => this.#toModelRecord(record));
  }

  async #queryByIndexKeys(keys, options = {}) {
    // In Postgres mode, empty keys are valid for all() queries (no DynamoDB partition key needed).
    // allByIndexKeys still requires non-empty keys via its own check.
    if (!isObject(keys)) {
      return this.#logAndThrowError(`Failed to query [${this.entityName}]: keys are required`);
    }

    if (!isObject(options)) {
      return this.#logAndThrowError(`Failed to query [${this.entityName}]: options must be an object`);
    }

    try {
      const shouldFetchAllPages = options.fetchAllPages === true
        || (options.fetchAllPages !== false && !options.limit);
      const shouldReturnCursor = options.returnCursor === true;
      const limit = Number.isInteger(options.limit) ? options.limit : undefined;

      let offset = decodeCursor(options.cursor);
      let allRows = [];
      let cursor = null;

      if (shouldFetchAllPages) {
        const pageSize = limit || DEFAULT_PAGE_SIZE;
        let keepGoing = true;

        while (keepGoing) {
          // eslint-disable-next-line no-await-in-loop
          const pageRows = await this.#queryPage({
            keys,
            options,
            offset,
            limit: pageSize,
          });
          allRows = allRows.concat(pageRows);
          if (pageRows.length < pageSize) {
            keepGoing = false;
            cursor = null;
          } else {
            offset += pageSize;
          }
        }
      } else {
        const pageRows = await this.#queryPage({
          keys,
          options,
          offset,
          limit,
        });
        allRows = pageRows;
        if (limit && pageRows.length === limit) {
          cursor = encodeCursor(offset + limit);
        }
      }

      if (options.limit === 1) {
        return allRows.length ? this.#createInstance(allRows[0]) : null;
      }

      const instances = this.#createInstances(allRows);
      return shouldReturnCursor ? { data: instances, cursor } : instances;
    } catch (error) {
      /* c8 ignore next 5 -- DataAccessError is already thrown by #queryPage */
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to query', error);
    }
  }

  async #onCreate(item) {
    try {
      await this._onCreate(item);
    } catch (error) {
      this.log.error('On-create handler failed', error);
    }
  }

  async #onCreateMany({ createdItems, errorItems }) {
    try {
      await this._onCreateMany({ createdItems, errorItems });
    /* c8 ignore next 3 -- defensive: only fires if subclass _onCreateMany throws */
    } catch (error) {
      this.log.error('On-create-many handler failed', error);
    }
  }

  // --- Public API (same signatures as BaseCollection) ---

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreate(item) {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreateMany({ createdItems, errorItems }) {
    return undefined;
  }

  applyUpdateWatchers(record, updates) {
    const nextRecord = { ...record };
    const nextUpdates = { ...updates };
    const changedKeys = Object.keys(updates);
    if (changedKeys.length === 0) {
      return { record: nextRecord, updates: nextUpdates };
    }

    const attributes = this.schema.getAttributes();
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (typeof attribute.set !== 'function') {
        return;
      }

      const { watch } = attribute;
      const shouldApply = watch === '*'
        || (Array.isArray(watch) && watch.some((key) => changedKeys.includes(key)));

      if (!shouldApply) {
        return;
      }

      const value = attribute.set(nextRecord[name], nextRecord);
      nextRecord[name] = value;
      nextUpdates[name] = value;
    });
    return { record: nextRecord, updates: nextUpdates };
  }

  async all(sortKeys = {}, options = {}) {
    return this.#queryByIndexKeys(sortKeys, options);
  }

  async allByIndexKeys(keys, options = {}) {
    if (!isNonEmptyObject(keys)) {
      return this.#logAndThrowError(`Failed to query [${this.entityName}]: keys are required`);
    }
    return this.#queryByIndexKeys(keys, options);
  }

  async findByAll(sortKeys = {}, options = {}) {
    if (!isObject(sortKeys)) {
      const message = `Failed to find by all [${this.entityName}]: sort keys must be an object`;
      this.log.error(message);
      throw new DataAccessError(message);
    }
    return this.#queryByIndexKeys(sortKeys, { ...options, limit: 1 });
  }

  async findById(id) {
    guardId(this.idName, id, this.entityName);
    return this.findByIndexKeys({ [this.idName]: id });
  }

  async existsById(id) {
    guardId(this.idName, id, this.entityName);
    const item = await this.findByIndexKeys(
      { [this.idName]: id },
      { attributes: [this.idName] },
    );
    return isNonEmptyObject(item);
  }

  async batchGetByKeys(keys, options = {}) {
    guardArray('keys', keys, this.entityName, 'any');

    try {
      const records = await Promise.all(
        keys.map((key) => this.findByIndexKeys(key, options)),
      );
      return {
        data: records.filter((record) => record !== null),
        unprocessed: [],
      };
    /* c8 ignore next 4 -- errors thrown by findByIndexKeys propagate directly */
    } catch (error) {
      this.log.error(`Failed to batch get by keys [${this.entityName}]`, error);
      throw new DataAccessError('Failed to batch get by keys', this, error);
    }
  }

  async findByIndexKeys(keys, options = {}) {
    return this.#queryByIndexKeys(keys, { ...options, limit: 1 });
  }

  async create(item, { upsert = false } = {}) {
    if (!isNonEmptyObject(item)) {
      const message = `Failed to create [${this.entityName}]: data is required`;
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const prepared = this.#prepareItem(item);
      const payload = this.#toDbRecord(prepared);
      const conflictKey = this.#toDbField(this.idName);

      let query = this.postgrestClient.from(this.tableName);
      query = upsert ? query.upsert(payload, { onConflict: conflictKey }) : query.insert(payload);
      const { data, error } = await query.select().maybeSingle();

      if (error) {
        return this.#logAndThrowError('Failed to create', error);
      }

      const instance = this.#createInstance(this.#toModelRecord(data));
      this.#invalidateCache();
      await this.#onCreate(instance);
      return instance;
    /* c8 ignore next 7 -- DataAccessError is already thrown by inner methods */
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to create', error);
    }
  }

  async createMany(newItems, parent = null) {
    if (!isNonEmptyArray(newItems)) {
      const message = `Failed to create many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const validatedItems = [];
      const errorItems = [];

      newItems.forEach((item) => {
        try {
          validatedItems.push(this.#prepareItem(item));
        } catch (error) {
          if (error instanceof ValidationError) {
            errorItems.push({ item, error });
          /* c8 ignore next 3 -- defensive: non-validation errors are unexpected */
          } else {
            throw error;
          }
        }
      });

      if (validatedItems.length > 0) {
        const payload = validatedItems.map((item) => this.#toDbRecord(item));
        const { error } = await this.postgrestClient
          .from(this.tableName)
          .insert(payload)
          .select();

        if (error) {
          return this.#logAndThrowError('Failed to create many', error);
        }
      }

      const createdItems = this.#createInstances(validatedItems);
      /* c8 ignore next 10 -- only exercised with real entity hierarchies in Tasks 7-8 */
      if (isNonEmptyObject(parent)) {
        createdItems.forEach((record) => {
          if (!isValidParent(parent, record)) {
            this.log.warn(`Failed to associate parent with child [${this.entityName}]: parent is invalid`);
            return;
          }
          // eslint-disable-next-line no-underscore-dangle,no-param-reassign
          record._accessorCache[`get${parent.schema.getModelName()}`] = parent;
        });
      }

      this.#invalidateCache();
      await this.#onCreateMany({ createdItems, errorItems });
      return { createdItems, errorItems };
    /* c8 ignore next 7 -- DataAccessError is already thrown by inner methods */
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to create many', error);
    }
  }

  async updateByKeys(keys, updates) {
    if (!isNonEmptyObject(keys) || !isNonEmptyObject(updates)) {
      throw new DataAccessError(`Failed to update [${this.entityName}]: keys and updates are required`);
    }

    let query = this.postgrestClient.from(this.tableName).update(this.#toDbRecord(updates));
    query = this.#applyKeyFilters(query, keys);

    const { error } = await query.select().maybeSingle();
    if (error) {
      throw new DataAccessError('Failed to update entity', this, error);
    }
  }

  async _saveMany(items) {
    if (!isNonEmptyArray(items)) {
      const message = `Failed to save many [${this.entityName}]: items must be a non-empty array`;
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      await Promise.all(
        items.map(async (item) => {
          const itemKeys = item.generateCompositeKeys
            ? item.generateCompositeKeys()
            : { [this.idName]: item.getId() };
          const { updates } = this.applyUpdateWatchers(item.record, item.record);
          await this.updateByKeys(itemKeys, updates);
        }),
      );

      this.#invalidateCache();
      return undefined;
    } catch (error) {
      /* c8 ignore next 5 -- DataAccessError is already thrown by updateByKeys */
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to save many', error);
    }
  }

  async removeByIds(ids) {
    if (!isNonEmptyArray(ids)) {
      const message = `Failed to remove [${this.entityName}]: ids must be a non-empty array`;
      this.log.error(message);
      throw new DataAccessError(message);
    }

    try {
      const { error } = await this.postgrestClient
        .from(this.tableName)
        .delete()
        .in(this.#toDbField(this.idName), ids);

      if (error) {
        return this.#logAndThrowError('Failed to remove by IDs', error);
      }

      this.#invalidateCache();
      return undefined;
    } catch (error) {
      /* c8 ignore next 5 -- DataAccessError is already thrown by #logAndThrowError */
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to remove by IDs', error);
    }
  }

  async removeByIndexKeys(keys) {
    if (!isNonEmptyArray(keys)) {
      const message = `Failed to remove by index keys [${this.entityName}]: keys must be a non-empty array`;
      this.log.error(message);
      throw new DataAccessError(message);
    }

    keys.forEach((key) => {
      if (!isNonEmptyObject(key)) {
        const message = `Failed to remove by index keys [${this.entityName}]: key must be a non-empty object`;
        this.log.error(message);
        throw new DataAccessError(message);
      }
    });

    try {
      await Promise.all(keys.map(async (key) => {
        let query = this.postgrestClient.from(this.tableName).delete();
        query = this.#applyKeyFilters(query, key);
        const { error } = await query;
        /* c8 ignore next 3 */
        if (error) {
          throw error;
        }
      }));

      this.log.info(`Removed ${keys.length} items for [${this.entityName}]`);
      this.#invalidateCache();
      return undefined;
    } catch (error) {
      /* c8 ignore next 5 */
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to remove by index keys', error);
    }
  }
}

export default PostgresBaseCollection;
