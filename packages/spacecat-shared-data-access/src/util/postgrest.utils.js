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

import pluralize from 'pluralize';

const DEFAULT_PAGE_SIZE = 1000;

const ENTITY_TABLE_OVERRIDES = {
  LatestAudit: 'audits',
};

const camelToSnake = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

const snakeToCamel = (value) => value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const entityToTableName = (entityName) => {
  const override = ENTITY_TABLE_OVERRIDES[entityName];
  if (override) {
    return override;
  }
  return camelToSnake(pluralize.plural(entityName));
};

const encodeCursor = (offset) => Buffer.from(JSON.stringify({ offset }), 'utf-8').toString('base64');

const decodeCursor = (cursor) => {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    return Number.isInteger(decoded.offset) && decoded.offset >= 0 ? decoded.offset : 0;
  } catch (e) {
    return 0;
  }
};

const createFieldMaps = (schema) => {
  const toDbMap = {};
  const toModelMap = {};
  const attributes = schema.getAttributes();
  const idName = typeof schema.getIdName === 'function' ? schema.getIdName() : undefined;
  Object.keys(attributes).forEach((modelField) => {
    const attribute = attributes[modelField] || {};
    if (attribute.postgrestIgnore) {
      return;
    }
    const dbField = attribute.postgrestField
      || (modelField === idName && modelField !== 'id' ? 'id' : camelToSnake(modelField));
    toDbMap[modelField] = dbField;
    toModelMap[dbField] = modelField;
  });

  const idAttribute = idName ? attributes[idName] : undefined;
  if (idName
    && idName !== 'id'
    && idAttribute
    && !idAttribute.postgrestIgnore) {
    toDbMap[idName] = 'id';
    toModelMap.id = idName;
  }

  return { toDbMap, toModelMap };
};

const toDbField = (field, map) => map[field] || camelToSnake(field);

const toModelField = (field, map) => map[field] || snakeToCamel(field);

const toDbRecord = (record, toDbMap, options = {}) => {
  const { includeUnknown = false } = options;
  return Object.entries(record).reduce((acc, [key, value]) => {
    if (Object.prototype.hasOwnProperty.call(toDbMap, key)) {
      acc[toDbMap[key]] = value;
      return acc;
    }

    if (includeUnknown) {
      acc[toDbField(key, toDbMap)] = value;
    }

    return acc;
  }, {});
};

const looksLikeIsoDateTime = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T/.test(value)
  && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);

const normalizeModelValue = (value) => {
  if (value === null) {
    return undefined;
  }

  if (Array.isArray(value) && value.length === 1 && value[0] === null) {
    return undefined;
  }

  if (looksLikeIsoDateTime(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return value;
};

const fromDbRecord = (record, toModelMap) => Object.entries(record).reduce((acc, [key, value]) => {
  const normalized = normalizeModelValue(value);
  if (normalized !== undefined) {
    acc[toModelField(key, toModelMap)] = normalized;
  }
  return acc;
}, {});

const applyWhere = (query, whereFn, toDbMap) => {
  if (typeof whereFn !== 'function') {
    return query;
  }

  const attrs = new Proxy({}, {
    get: (_, prop) => toDbField(String(prop), toDbMap),
  });

  const op = {
    eq: (field, value) => ({ type: 'eq', field, value }),
    contains: (field, value) => ({ type: 'contains', field, value }),
  };

  const expression = whereFn(attrs, op);
  if (!expression || typeof expression !== 'object') {
    return query;
  }

  if (expression.type === 'eq') {
    return query.eq(expression.field, expression.value);
  }

  if (expression.type === 'contains') {
    const value = Array.isArray(expression.value) ? expression.value : [expression.value];
    return query.contains(expression.field, value);
  }

  throw new Error(`Unsupported where operator: ${expression.type}`);
};

export {
  DEFAULT_PAGE_SIZE,
  applyWhere,
  camelToSnake,
  createFieldMaps,
  decodeCursor,
  encodeCursor,
  entityToTableName,
  fromDbRecord,
  snakeToCamel,
  toDbField,
  toDbRecord,
  toModelField,
};
