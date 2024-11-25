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

const entityNameToCollectionName = (entityName) => `${pluralize.singular(entityName)}Collection`;
const entityNameToIdName = (collectionName) => `${collectionName.charAt(0).toLowerCase() + collectionName.slice(1)}Id`;
const entityNameToReferenceMethodName = (target, type) => {
  let baseName = target.charAt(0).toUpperCase() + target.slice(1);
  baseName = type === 'has_many'
    ? pluralize.plural(baseName)
    : pluralize.singular(baseName);

  return `get${baseName}`;
};

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const keyNamesToIndexName = (keyNames) => {
  const capitalizedKeyNames = keyNames.map((keyName) => capitalize(keyName));
  return `by${capitalizedKeyNames.join('And')}`;
};

export {
  entityNameToCollectionName,
  entityNameToIdName,
  entityNameToReferenceMethodName,
  keyNamesToIndexName,
};
