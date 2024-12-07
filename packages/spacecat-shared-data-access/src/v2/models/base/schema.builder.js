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

import { hasText, isInteger, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import { v4 as uuid, validate as uuidValidate } from 'uuid';
import { capitalize, decapitalize, entityNameToIdName } from '../../util/util.js';

const ID_ATTRIBUTE_DATA = {
  type: 'string',
  required: true,
  readOnly: true,
  // https://electrodb.dev/en/modeling/attributes/#default
  default: () => uuid(),
  // https://electrodb.dev/en/modeling/attributes/#attribute-validation
  validate: (value) => uuidValidate(value),
};

const CREATED_AT_ATTRIBUTE_DATA = {
  type: 'string',
  readOnly: true,
  required: true,
  default: () => new Date().toISOString(),
};

const UPDATED_AT_ATTRIBUTE_DATA = {
  type: 'string',
  required: true,
  readOnly: true,
  watch: '*',
  default: () => new Date().toISOString(),
  set: () => new Date().toISOString(),
};

const PRIMARY_INDEX_NAME = 'primary';

class SchemaBuilder {
  static REFERENCE_TYPES = {
    BELONGS_TO: 'belongs_to',
    HAS_MANY: 'has_many',
    HAS_ONE: 'has_one',
  };

  constructor(entityName, schemaVersion, serviceName) {
    if (!hasText(entityName)) {
      throw new Error('entityName is required');
    }

    if (!isInteger(schemaVersion) && schemaVersion > 0) {
      throw new Error('schemaVersion is required');
    }

    if (!hasText(serviceName)) {
      throw new Error('serviceName is required');
    }

    this.entityName = entityName;
    this.idName = entityNameToIdName(entityName);
    this.serviceName = serviceName;

    this.schema = {
      model: {
        entity: entityName,
        version: String(schemaVersion),
        service: serviceName,
      },
      attributes: {},
      indexes: {},
      references: { belongs_to: [], has_many: [], has_one: [] },
    };

    this.#initialize();
  }

  #initialize() {
    this.addAttribute(this.idName, ID_ATTRIBUTE_DATA);
    this.addAttribute('createdAt', CREATED_AT_ATTRIBUTE_DATA);
    this.addAttribute('updatedAt', UPDATED_AT_ATTRIBUTE_DATA);
    // todo: add createdBy, updatedBy and auto-set from auth context

    this.addIndex(
      PRIMARY_INDEX_NAME,
      { field: 'pk', composite: [this.idName] },
      { field: 'sk', composite: [] },
    );
  }

  addAttribute(name, data) {
    if (!hasText(name)) {
      throw new Error('name is required');
    }

    if (!isNonEmptyObject(data)) {
      throw new Error('data is required');
    }

    this.schema.attributes[name] = data;

    return this;
  }

  addIndex(name, partitionKey, sortKey) {
    if (!hasText(name)) {
      throw new Error('name is required');
    }

    if (!isNonEmptyObject(partitionKey)) {
      throw new Error('pk is required');
    }

    if (!isNonEmptyObject(sortKey)) {
      throw new Error('sk is required');
    }

    const indexNumber = Object.keys(this.schema.indexes).length;
    const pkFieldName = partitionKey.field ? partitionKey.field : `gsi${indexNumber}pk`;
    const skFieldName = sortKey.field ? sortKey.field : `gsi${indexNumber}sk`;
    const indexName = `${this.serviceName.toLowerCase()}-data-${this.entityName}-${name}`;

    this.schema.indexes[name] = {
      ...(name !== PRIMARY_INDEX_NAME && { index: indexName }),
      pk: {
        ...partitionKey,
        field: pkFieldName,
      },
      sk: {
        ...sortKey,
        field: skFieldName,
      },
    };

    return this;
  }

  addReference(referenceType, entityName, sortKeys = ['updatedAt'], required = true) {
    if (!Object.values(SchemaBuilder.REFERENCE_TYPES).includes(referenceType)) {
      throw new Error('Invalid referenceType');
    }

    if (!hasText(entityName)) {
      throw new Error('entityName is required');
    }

    this.schema.references[referenceType].push({ target: entityName });

    if (referenceType === SchemaBuilder.REFERENCE_TYPES.BELONGS_TO) {
      const foreignKeyName = entityNameToIdName(entityName);

      this.addAttribute(foreignKeyName, {
        type: 'string',
        required,
        validate: (value) => (required ? uuidValidate(value) : !value || uuidValidate(value)),
      });

      if (!required) {
        return this;
      }

      this.addIndex(
        `by${capitalize(foreignKeyName)}`,
        { composite: [decapitalize(foreignKeyName)] },
        { composite: sortKeys },
      );
    }

    return this;
  }

  build() {
    return this.schema;
  }
}

export default SchemaBuilder;
