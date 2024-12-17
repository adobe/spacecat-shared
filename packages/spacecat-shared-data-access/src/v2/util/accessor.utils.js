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

import { hasText, isNonEmptyObject, isNumber } from '@adobe/spacecat-shared-utils';

import ValidationError from '../errors/validation.error.js';

function validateValue(context, keyName, value) {
  const { type } = context.schema.getAttribute(keyName);
  const validator = type === 'number' ? isNumber : hasText;

  if (!validator(value)) {
    throw new ValidationError(`${keyName} is required`);
  }
}

function parseAccessorArgs(context, requiredKeyNames, args) {
  const keys = {};
  for (let i = 0; i < requiredKeyNames.length; i += 1) {
    const keyName = requiredKeyNames[i];
    const keyValue = args[i];

    validateValue(context, keyName, keyValue);

    keys[keyName] = keyValue;
  }

  let options = {};

  if (args.length > requiredKeyNames.length) {
    options = args[requiredKeyNames.length];
  }

  return { keys, options };
}

export function createAccessor(
  context,
  collection,
  name,
  requiredKeyNames,
  all,
  foreignKey,
) {
  const foreignKeys = {
    ...isNonEmptyObject(foreignKey) && { [foreignKey.name]: foreignKey.value },
  };
  const accessor = async (...args) => {
    const { keys, options } = parseAccessorArgs(collection, requiredKeyNames, args);
    const allKeys = { ...foreignKeys, ...keys };

    return all
      ? collection.allByIndexKeys(allKeys, options)
      : collection.findByIndexKeys(allKeys, options);
  };

  Object.defineProperty(
    context,
    name,
    {
      enumerable: false,
      configurable: false,
      writable: true,
      value: accessor,
    },
  );
}
