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

import { hasText, isInteger } from '@adobe/spacecat-shared-utils';
import pluralize from 'pluralize';

const capitalize = (str) => (hasText(str) ? str[0].toUpperCase() + str.slice(1) : '');
const decapitalize = (str) => (hasText(str) ? str[0].toLowerCase() + str.slice(1) : '');

const collectionNameToEntityName = (collectionName) => collectionName.replace('Collection', '');

const entityNameToCollectionName = (entityName) => `${capitalize(pluralize.singular(entityName))}Collection`;

const entityNameToIdName = (entityName) => `${decapitalize(entityName)}Id`;

const entityNameToReferenceMethodName = (target, type) => {
  const baseName = type === 'has_many'
    ? pluralize.plural(capitalize(target))
    : pluralize.singular(capitalize(target));
  return `get${baseName}`;
};

const entityNameToAllPKValue = (entityName) => `ALL_${pluralize.plural(entityName.toUpperCase())}`;

const idNameToEntityName = (idName) => capitalize(pluralize.singular(idName.replace('Id', '')));

const keyNamesToIndexName = (keyNames) => `by${keyNames.map(capitalize).join('And')}`;

const keyNamesToMethodName = (keyNames, prefix) => prefix + keyNames.map(capitalize).join('And');

const modelNameToEntityName = (modelName) => decapitalize(modelName);

const sanitizeTimestamps = (data) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdAt, updatedAt, ...rest } = data;
  return rest;
};

const sanitizeIdAndAuditFields = (entityName, data) => {
  const idName = entityNameToIdName(entityName);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [idName]: _, ...rest } = data;
  return sanitizeTimestamps(rest);
};

const incrementVersion = (version) => (isInteger(version) ? parseInt(version, 10) + 1 : 1);

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

export {
  capitalize,
  collectionNameToEntityName,
  decapitalize,
  entityNameToCollectionName,
  entityNameToIdName,
  entityNameToAllPKValue,
  entityNameToReferenceMethodName,
  idNameToEntityName,
  incrementVersion,
  isNonEmptyArray,
  keyNamesToIndexName,
  keyNamesToMethodName,
  modelNameToEntityName,
  sanitizeIdAndAuditFields,
  sanitizeTimestamps,
};
