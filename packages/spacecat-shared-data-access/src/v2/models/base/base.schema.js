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

import { v4 as uuid, validate as uuidValidate } from 'uuid';

export const getIdName = (entity) => `${entity.charAt(0).toLowerCase()}${entity.slice(1)}Id`;

const createSchema = (entity, version, service, schema) => {
  const idName = getIdName(entity);

  const baseAttributes = {
    [idName]: {
      type: 'string',
      required: true,
      readOnly: true,
      // https://electrodb.dev/en/modeling/attributes/#default
      default: () => uuid(),
      // https://electrodb.dev/en/modeling/attributes/#attribute-validation
      validate: (value) => uuidValidate(value),
    },
    createdAt: {
      type: 'string',
      readOnly: true,
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      readOnly: true,
      watch: '*',
      default: () => new Date().toISOString(),
      set: () => new Date().toISOString(),
    },
    // todo: add createdBy, updatedBy and auto-set from auth context
  };

  return {
    model: {
      entity,
      version,
      service,
    },
    attributes: {
      ...baseAttributes,
      ...schema.attributes,
    },
    indexes: {
      // standard index (main table) for the entity's primary key (ID)
      primary: {
        pk: {
          field: 'pk',
          composite: [idName],
        },
        sk: {
          field: 'sk',
          composite: [],
        },
      },
      ...schema.indexes,
    },
    references: {
      ...schema.references,
    },
  };
};

export default createSchema;
