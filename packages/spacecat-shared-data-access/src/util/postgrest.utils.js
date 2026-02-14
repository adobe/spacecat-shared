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

// DynamoDB-only attributes that do not exist in the Postgres schema.
const DYNAMO_ONLY_FIELDS = new Set(['recordExpiresAt']);

const createFieldMaps = (schema) => {
  const toDbMap = {};
  const toModelMap = {};
  const attributes = schema.getAttributes();
  const idName = typeof schema.getIdName === 'function' ? schema.getIdName() : undefined;
  Object.keys(attributes).forEach((modelField) => {
    if (DYNAMO_ONLY_FIELDS.has(modelField)) return;
    const attribute = attributes[modelField] || {};
    // postgrestField: false means this attribute has no Postgres column.
    if (attribute.postgrestField === false) return;
    const dbField = attribute.postgrestField
      || (modelField === idName && modelField !== 'id' ? 'id' : camelToSnake(modelField));
    toDbMap[modelField] = dbField;
    toModelMap[dbField] = modelField;
  });

  if (idName && idName !== 'id') {
    toDbMap[idName] = 'id';
    toModelMap.id = idName;
  }

  return { toDbMap, toModelMap };
};

const toDbField = (field, map) => map[field] || camelToSnake(field);

const toModelField = (field, map) => map[field] || snakeToCamel(field);

const toDbRecord = (record, toDbMap) => Object.entries(record).reduce((acc, [key, value]) => {
  // Only include fields that exist in the schema's field map.
  // This strips DynamoDB-specific attributes (GSI keys, recordExpiresAt, etc.)
  // that have no corresponding Postgres column.
  if (!toDbMap[key]) return acc;
  acc[toDbMap[key]] = value;
  return acc;
}, {});

// Postgres returns timestamptz values with '+00:00' suffix and variable fractional-second
// precision (e.g. '.71' instead of '.710'). Normalize to ISO-8601 with 'Z' suffix and exactly
// 3-digit milliseconds for DynamoDB compatibility.
const TIMESTAMP_SUFFIX_RE = /\+00:00$/;

const normalizeValue = (value) => {
  if (typeof value === 'string' && TIMESTAMP_SUFFIX_RE.test(value)) {
    let normalized = value.replace(TIMESTAMP_SUFFIX_RE, 'Z');
    // Normalize fractional seconds to exactly 3 digits.
    normalized = normalized.replace(/(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/, (_, time, frac) => {
      const millis = (frac || '0').slice(0, 3).padEnd(3, '0');
      return `${time}.${millis}Z`;
    });
    return normalized;
  }
  return value;
};

const fromDbRecord = (record, toModelMap) => Object.entries(record).reduce((acc, [key, value]) => {
  // Strip null values to match DynamoDB behavior (DynamoDB omits unset attributes).
  if (value === null) return acc;
  const modelKey = toModelField(key, toModelMap);
  // PostgREST returns {NULL} for empty Postgres arrays -> [null] in JS; treat as unset.
  if (Array.isArray(value) && value.length === 1 && value[0] === null) {
    return acc;
  }
  acc[modelKey] = normalizeValue(value);
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

  return query;
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
