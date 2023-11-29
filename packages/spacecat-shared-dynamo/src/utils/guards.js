/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { hasText, isObject } from '@adobe/spacecat-shared-utils';

/**
 * Validates that the provided table name is a non-empty string.
 *
 * @param {string} tableName - The name of the table to validate.
 * @throws {Error} If the table name is empty or not a string.
 */
const guardTableName = (tableName) => {
  if (!hasText(tableName)) {
    throw new Error('Table name is required.');
  }
};

/**
 * Validates that the provided key is an object and contains a partitionKey.
 *
 * @param {object} key - The key object to validate.
 * @throws {Error} If the key is not an object or does not contain a partitionKey.
 */
const guardKey = (key) => {
  if (!isObject(key) || !key.partitionKey) {
    throw new Error('Key must be an object with a partitionKey.');
  }
};

/**
 * Validates that the provided parameters object contains the required query parameters.
 *
 * @param {object} params - The parameters object to validate.
 * @throws {Error} If the parameters object is not an object or is missing required properties.
 */
const guardQueryParameters = (params) => {
  if (!isObject(params)) {
    throw new Error('Query parameters must be an object.');
  }

  const requiredProps = ['TableName', 'KeyConditionExpression', 'ExpressionAttributeValues'];
  for (const prop of requiredProps) {
    if (!Object.prototype.hasOwnProperty.call(params, prop)) {
      throw new Error(`Query parameters is missing required parameter: ${prop}`);
    }
  }
};

export {
  guardKey,
  guardQueryParameters,
  guardTableName,
};
