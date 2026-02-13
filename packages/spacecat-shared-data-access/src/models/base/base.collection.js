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
  hasText,
  isNonEmptyArray,
  isNonEmptyObject,
  isObject,
} from '@adobe/spacecat-shared-utils';

import DataAccessError from '../../errors/data-access.error.js';
import ValidationError from '../../errors/validation.error.js';
import { createAccessors } from '../../util/accessor.utils.js';
import { guardId, guardArray } from '../../util/guards.js';
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
} from '../../util/postgrest.utils.js';
import { DATASTORE_TYPE } from '../../util/index.js';
import { entityNameToAllPKValue, removeElectroProperties } from '../../util/util.js';

const isLegacyValidationError = (error) => error?.name === 'ElectroValidationError'
  || isNonEmptyArray(error?.fields);

function isValidParent(parent, child) {
  if (!hasText(parent.entityName)) {
    return false;
  }

  const foreignKey = `${parent.entityName}Id`;
  return child.record?.[foreignKey] === parent.record?.[foreignKey];
}

class BaseCollection {
  static COLLECTION_NAME = undefined;

  static DATASTORE_TYPE = DATASTORE_TYPE.POSTGREST;

  constructor(postgrestService, entityRegistry, schema, log) {
    if (!postgrestService) {
      throw new DataAccessError('postgrestService is required');
    }
    this.postgrestService = postgrestService;
    // legacy alias for existing tests and callers
    this.electroService = postgrestService;
    this.entityRegistry = entityRegistry;
    this.schema = schema;
    this.log = log;

    this.clazz = this.schema.getModelClass();
    this.entityName = this.schema.getEntityName();
    this.idName = this.schema.getIdName();
    this.tableName = entityToTableName(this.schema.getModelName());
    this.fieldMaps = createFieldMaps(this.schema);
    this.entity = postgrestService?.entities?.[this.entityName];

    this.#initializeCollectionMethods();
  }

  // eslint-disable-next-line class-methods-use-this
  #resolveBulkKeyField(keys) {
    if (!isNonEmptyArray(keys)) {
      return null;
    }

    const firstKey = keys[0];
    if (!isNonEmptyObject(firstKey)) {
      return null;
    }

    const fields = Object.keys(firstKey);
    if (fields.length !== 1) {
      return null;
    }

    const [field] = fields;
    const isSingleFieldAcrossAll = keys.every((key) => {
      if (!isNonEmptyObject(key)) {
        return false;
      }
      const keyFields = Object.keys(key);
      return keyFields.length === 1 && keyFields[0] === field && key[field] !== undefined;
    });

    return isSingleFieldAcrossAll ? field : null;
  }

  // eslint-disable-next-line class-methods-use-this
  #isInvalidInputError(error) {
    let current = error;
    while (current) {
      if (current?.code === '22P02') {
        return true;
      }
      current = current.cause;
    }
    return false;
  }

  #logAndThrowError(message, cause) {
    const error = new DataAccessError(message, this, cause);
    this.log.error(`Base Collection Error [${this.entityName}]`, error);
    if (isNonEmptyArray(error.cause?.fields)) {
      this.log.error(`Validation errors: ${JSON.stringify(error.cause.fields)}`);
    }
    throw error;
  }

  #initializeCollectionMethods() {
    const accessorConfigs = this.schema.toAccessorConfigs(this, this.log);
    createAccessors(accessorConfigs, this.log);
  }

  #createInstance(record) {
    if (!isNonEmptyObject(record)) {
      this.log.warn(`Failed to create instance of [${this.entityName}]: record is empty`);
      return null;
    }
    const hydratedRecord = this.#applyGetters(this.#applyReadDefaults(record));
    // eslint-disable-next-line new-cap
    return new this.clazz(
      this.postgrestService,
      this.entityRegistry,
      this.schema,
      hydratedRecord,
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
    } catch (error) {
      this.log.error('On-create-many handler failed', error);
    }
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreate(item) {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async _onCreateMany({ createdItems, errorItems }) {
    return undefined;
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

    const keyNames = Object.keys(keys);
    const defaultSortField = isNonEmptyArray(keyNames)
      ? keyNames[keyNames.length - 1]
      : 'updatedAt';
    return this.#toDbField(defaultSortField);
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
      let resolvedValue = value;
      if (name === 'updatedAt' && typeof nextRecord[name] === 'string') {
        const previous = new Date(nextRecord[name]);
        const candidate = new Date(resolvedValue);
        if (!Number.isNaN(previous.getTime())
          && !Number.isNaN(candidate.getTime())
          && candidate.getTime() <= previous.getTime()) {
          resolvedValue = new Date(previous.getTime() + 1000).toISOString();
        }
      }
      nextRecord[name] = resolvedValue;
      nextUpdates[name] = resolvedValue;
    });
    return { record: nextRecord, updates: nextUpdates };
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

  #applyReadDefaults(record) {
    const nextRecord = { ...record };
    const attributes = this.schema.getAttributes();
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (nextRecord[name] !== undefined || attribute.default === undefined) {
        return;
      }

      // Only hydrate defaults for fields intentionally excluded from PostgREST writes.
      // This preserves projection behavior for normal selected attributes.
      if (!attribute.postgrestIgnore) {
        return;
      }

      nextRecord[name] = typeof attribute.default === 'function'
        ? attribute.default()
        : attribute.default;
    });
    return nextRecord;
  }

  #applyGetters(record) {
    const nextRecord = { ...record };
    const attributes = this.schema.getAttributes();
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (typeof attribute.get !== 'function') {
        return;
      }

      if (nextRecord[name] === undefined) {
        return;
      }

      try {
        nextRecord[name] = attribute.get(nextRecord[name], nextRecord);
      } catch (error) {
        this.log.warn(`Failed to apply getter for ${name} on [${this.entityName}]`, error);
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
          errors.push(e?.message || `${name} failed validation`);
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
    if (!isNonEmptyObject(keys)) {
      return query;
    }

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
    let query = this.postgrestService
      .from(this.tableName)
      .select(select)
      .order(orderField, { ascending: options.order === 'asc' });

    if (this.fieldMaps?.toDbMap?.[this.idName] === 'id') {
      query = query.order('id', { ascending: false });
    }

    query = this.#applyKeyFilters(query, keys);
    if (isObject(options.between)) {
      const betweenField = this.#toDbField(options.between.attribute);
      query = query.gte(betweenField, options.between.start).lte(betweenField, options.between.end);
    }
    query = applyWhere(query, options.where, this.fieldMaps.toDbMap);

    if (Number.isInteger(limit)) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.range(offset, offset + DEFAULT_PAGE_SIZE - 1);
    }

    const { data, error } = await query;
    if (error) {
      this.#logAndThrowError('Failed to query', error);
    }

    return (data || []).map((record) => this.#toModelRecord(record));
  }

  async #queryByIndexKeys(keys, options = {}) {
    if (this.entity && !isNonEmptyObject(keys)) {
      return this.#logAndThrowError(`Failed to query [${this.entityName}]: keys are required`);
    }

    if (!isObject(options)) {
      return this.#logAndThrowError(`Failed to query [${this.entityName}]: options must be an object`);
    }

    try {
      if (this.entity) {
        const indexName = options.index || this.schema.findIndexNameByKeys(keys);
        const index = this.entity.query[indexName];
        if (!index) {
          this.#logAndThrowError(`Failed to query [${this.entityName}]: query proxy [${indexName}] not found`);
        }

        const queryOptions = {
          order: options.order || 'desc',
          ...options.limit && { limit: options.limit },
          ...options.attributes && { attributes: options.attributes },
          ...options.cursor && { cursor: options.cursor },
        };

        let query = index(keys);
        if (isObject(options.between)) {
          query = query.between(
            { [options.between.attribute]: options.between.start },
            { [options.between.attribute]: options.between.end },
          );
        }
        if (typeof options.where === 'function') {
          query = query.where(options.where);
        }

        let result = await query.go(queryOptions);
        let allData = result.data;
        const shouldFetchAllPages = options.fetchAllPages === true
          || (options.fetchAllPages !== false && !options.limit);
        if (shouldFetchAllPages) {
          while (result.cursor) {
            queryOptions.cursor = result.cursor;
            // eslint-disable-next-line no-await-in-loop
            result = await query.go(queryOptions);
            allData = allData.concat(result.data);
          }
        }

        if (options.limit === 1) {
          return allData.length ? this.#createInstance(allData[0]) : null;
        }

        const instances = this.#createInstances(allData);
        return options.returnCursor
          ? { data: instances, cursor: result.cursor || null }
          : instances;
      }

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
      if (error instanceof DataAccessError) {
        throw error;
      }
      return this.#logAndThrowError('Failed to query', error);
    }
  }

  async all(sortKeys = {}, options = {}) {
    const keys = this.entity
      ? { pk: entityNameToAllPKValue(this.entityName), ...sortKeys }
      : sortKeys;
    return this.#queryByIndexKeys(keys, options);
  }

  async allByIndexKeys(keys, options = {}) {
    return this.#queryByIndexKeys(keys, options);
  }

  async findByAll(sortKeys = {}, options = {}) {
    if (!isObject(sortKeys)) {
      const message = `Failed to find by all [${this.entityName}]: sort keys must be an object`;
      this.log.error(message);
      throw new DataAccessError(message);
    }
    const keys = this.entity
      ? { pk: entityNameToAllPKValue(this.entityName), ...sortKeys }
      : sortKeys;
    return this.#queryByIndexKeys(keys, { ...options, limit: 1 });
  }

  async findById(id) {
    guardId(this.idName, id, this.entityName);
    if (this.entity) {
      const record = await this.entity.get({ [this.idName]: id }).go();
      return this.#createInstance(record?.data);
    }
    return this.findByIndexKeys({ [this.idName]: id });
  }

  async existsById(id) {
    guardId(this.idName, id, this.entityName);
    if (this.entity) {
      const record = await this.entity.get({ [this.idName]: id }).go({
        attributes: [this.idName],
      });
      return isNonEmptyObject(record?.data);
    }
    const item = await this.findByIndexKeys(
      { [this.idName]: id },
      { attributes: [this.idName] },
    );
    return isNonEmptyObject(item);
  }

  async batchGetByKeys(keys, options = {}) {
    guardArray('keys', keys, this.entityName, 'any');

    try {
      if (this.entity) {
        const goOptions = {};
        if (options.attributes !== undefined) {
          goOptions.attributes = options.attributes;
        }
        const result = await this.entity.get(keys).go(goOptions);
        const data = result.data
          .map((record) => this.#createInstance(record))
          .filter((entity) => entity !== null);
        const unprocessed = result.unprocessed
          ? result.unprocessed.map((item) => item)
          : [];
        return { data, unprocessed };
      }

      const bulkKeyField = this.#resolveBulkKeyField(keys);
      if (bulkKeyField) {
        const dbField = this.#toDbField(bulkKeyField);
        const values = keys.map((key) => key[bulkKeyField]);
        const select = this.#buildSelect(options.attributes);
        const { data, error } = await this.postgrestService
          .from(this.tableName)
          .select(select)
          .in(dbField, values);

        if (!error) {
          return {
            data: this.#createInstances((data || []).map((record) => this.#toModelRecord(record))),
            unprocessed: [],
          };
        }

        if (!this.#isInvalidInputError(error)) {
          throw error;
        }
      }

      const records = await Promise.all(
        keys.map(async (key) => {
          try {
            return await this.findByIndexKeys(key, options);
          } catch (error) {
            if (this.#isInvalidInputError(error)) {
              return null;
            }
            throw error;
          }
        }),
      );
      return {
        data: records.filter((record) => record !== null),
        unprocessed: [],
      };
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
      if (this.entity) {
        const record = upsert
          ? await this.entity.put(item).go()
          : await this.entity.create(item).go();
        const instance = this.#createInstance(record.data);
        this.#invalidateCache();
        await this.#onCreate(instance);
        return instance;
      }

      const prepared = this.#prepareItem(item);
      const payload = this.#toDbRecord(prepared);
      const conflictKey = this.#toDbField(this.idName);

      let query = this.postgrestService.from(this.tableName);
      query = upsert ? query.upsert(payload, { onConflict: conflictKey }) : query.insert(payload);
      const { data, error } = await query.select().maybeSingle();

      if (error) {
        return this.#logAndThrowError('Failed to create', error);
      }

      const instance = this.#createInstance(this.#toModelRecord(data));
      this.#invalidateCache();
      await this.#onCreate(instance);
      return instance;
    } catch (error) {
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
      if (this.entity) {
        const validatedItems = [];
        const errorItems = [];
        newItems.forEach((item) => {
          try {
            const { Item } = this.entity.put(item).params();
            validatedItems.push({ ...removeElectroProperties(Item), ...item });
          } catch (error) {
            if (isLegacyValidationError(error)) {
              errorItems.push({ item, error: new ValidationError('Validation error', this, error) });
            }
          }
        });

        if (validatedItems.length > 0) {
          const response = await this.entity.put(validatedItems).go();
          if (isNonEmptyArray(response?.unprocessed)) {
            this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
          }
        }

        const createdItems = this.#createInstances(validatedItems);
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
      }

      const validatedItems = [];
      const errorItems = [];

      newItems.forEach((item) => {
        try {
          validatedItems.push(this.#prepareItem(item));
        } catch (error) {
          if (error instanceof ValidationError) {
            errorItems.push({ item, error });
          } else {
            throw error;
          }
        }
      });

      if (validatedItems.length > 0) {
        const payload = validatedItems.map((item) => this.#toDbRecord(item));
        const { data, error } = await this.postgrestService
          .from(this.tableName)
          .insert(payload)
          .select();

        if (error) {
          return this.#logAndThrowError('Failed to create many', error);
        }

        if (isNonEmptyArray(data)) {
          const createdItems = this.#createInstances(
            data.map((record) => this.#toModelRecord(record)),
          );
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
        }
      }

      const createdItems = this.#createInstances(validatedItems);
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
    } catch (error) {
      return this.#logAndThrowError('Failed to create many', error);
    }
  }

  async updateByKeys(keys, updates) {
    if (!isNonEmptyObject(keys) || !isNonEmptyObject(updates)) {
      throw new DataAccessError(`Failed to update [${this.entityName}]: keys and updates are required`);
    }

    if (this.entity) {
      const patch = this.entity.patch(keys);
      Object.entries(updates).forEach(([key, value]) => {
        patch.set({ [key]: value });
      });
      await patch.go();
      return;
    }

    let query = this.postgrestService.from(this.tableName).update(this.#toDbRecord(updates));
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
      if (this.entity) {
        const updates = items.map((item) => item.record);
        const response = await this.entity.put(updates).go();
        const now = new Date().toISOString();
        items.forEach((item) => {
          const { record } = item;
          record.updatedAt = now;
        });
        if (isNonEmptyArray(response.unprocessed)) {
          this.log.error(`Failed to process all items in batch write for [${this.entityName}]: ${JSON.stringify(response.unprocessed)}`);
        }
        this.#invalidateCache();
        return undefined;
      }

      await Promise.all(
        items.map(async (item) => {
          const keys = item.generateCompositeKeys
            ? item.generateCompositeKeys()
            : { [this.idName]: item.getId() };
          const { updates } = this.applyUpdateWatchers(item.record, item.record);
          await this.updateByKeys(keys, updates);
        }),
      );

      this.#invalidateCache();
      return undefined;
    } catch (error) {
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
      if (this.entity) {
        await this.entity.delete(ids.map((id) => ({ [this.idName]: id }))).go();
        this.#invalidateCache();
        return undefined;
      }

      const { error } = await this.postgrestService
        .from(this.tableName)
        .delete()
        .in(this.#toDbField(this.idName), ids);

      if (error) {
        return this.#logAndThrowError('Failed to remove by IDs', error);
      }

      this.#invalidateCache();
      return undefined;
    } catch (error) {
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
      if (this.entity) {
        await this.entity.delete(keys).go();
        this.log.info(`Removed ${keys.length} items for [${this.entityName}]`);
        this.#invalidateCache();
        return undefined;
      }

      const bulkKeyField = this.#resolveBulkKeyField(keys);
      if (bulkKeyField) {
        const dbField = this.#toDbField(bulkKeyField);
        const values = keys.map((key) => key[bulkKeyField]);
        const { error } = await this.postgrestService
          .from(this.tableName)
          .delete()
          .in(dbField, values);
        if (error) {
          throw error;
        }
      } else {
        await Promise.all(keys.map(async (key) => {
          let query = this.postgrestService.from(this.tableName).delete();
          query = this.#applyKeyFilters(query, key);
          const { error } = await query;
          if (error) {
            throw error;
          }
        }));
      }

      this.log.info(`Removed ${keys.length} items for [${this.entityName}]`);
      this.#invalidateCache();
      return undefined;
    } catch (error) {
      return this.#logAndThrowError('Failed to remove by index keys', error);
    }
  }
}

export default BaseCollection;
