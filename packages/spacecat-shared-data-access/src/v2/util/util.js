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

import pluralize from 'pluralize';
import { isInteger } from '@adobe/spacecat-shared-utils';

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const entityNameToCollectionName = (entityName) => `${pluralize.singular(entityName)}Collection`;
const entityNameToIdName = (collectionName) => `${collectionName.charAt(0).toLowerCase() + collectionName.slice(1)}Id`;
const entityNameToReferenceMethodName = (target, type) => {
  let baseName = target.charAt(0).toUpperCase() + target.slice(1);
  baseName = type === 'has_many'
    ? pluralize.plural(baseName)
    : pluralize.singular(baseName);

  return `get${baseName}`;
};

const idNameToEntityName = (idName) => capitalize(pluralize.singular(idName.replace('Id', '')));

const keyNamesToIndexName = (keyNames) => {
  const capitalizedKeyNames = keyNames.map((keyName) => capitalize(keyName));
  return `by${capitalizedKeyNames.join('And')}`;
};

const sanitizeTimestamps = (data) => {
  const sanitizedData = { ...data };

  delete sanitizedData.createdAt;
  delete sanitizedData.updatedAt;

  return sanitizedData;
};

const sanitizeIdAndAuditFields = (entityName, data) => {
  const idName = entityNameToIdName(entityName);
  const sanitizedData = { ...data };

  delete sanitizedData[idName];

  return sanitizeTimestamps(sanitizedData);
};

function incrementVersion(version) {
  if (!isInteger(version)) return 1;

  const versionNumber = parseInt(version, 10);
  return versionNumber + 1;
}

export {
  capitalize,
  entityNameToCollectionName,
  entityNameToIdName,
  entityNameToReferenceMethodName,
  idNameToEntityName,
  incrementVersion,
  keyNamesToIndexName,
  sanitizeIdAndAuditFields,
  sanitizeTimestamps,
};
