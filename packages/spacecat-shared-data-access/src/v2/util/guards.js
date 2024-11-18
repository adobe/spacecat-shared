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

import { hasText, isNumber, isObject } from '@adobe/spacecat-shared-utils';
import { validate as validateUUID } from 'uuid';

/**
 * Validates that a given property is an array.
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not an array.
 */
export const guardArray = (propertyName, value, entityName) => {
  // array must be non-empty and have all string values
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === 'string')) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} must be a non-empty array of strings`);
  }
};

/**
 * Validates that a given property is a string.
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not a valid string.
 */
export const guardString = (propertyName, value, entityName) => {
  if (!hasText(value)) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} is required`);
  }
};

/**
 * Validates that a given property is of an enum type.
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param enumValues - Allowed enum values.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not a valid enum value.
 */
export const guardEnum = (propertyName, value, enumValues, entityName) => {
  if (!enumValues.includes(value)) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} must be one of ${enumValues}`);
  }
};

/**
 * Validates that a given property is a valid ID.
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not a valid ID.
 */
export const guardId = (propertyName, value, entityName) => {
  if (!validateUUID(value)) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} must be a valid UUID`);
  }
};

/**
 * Validates that a given property is a map (object).
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not a valid map (object).
 */
export const guardMap = (propertyName, value, entityName) => {
  if (!isObject(value)) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} must be an object`);
  }
};

/**
 * Validates that a given property is a number.
 * @param propertyName - Name of the property being validated.
 * @param value - The value to validate.
 * @param entityName - Name of the entity containing this property.
 * @throws Will throw an error if the value is not a valid number.
 */
export const guardNumber = (propertyName, value, entityName) => {
  if (!isNumber(value)) {
    throw new Error(`Validation failed in ${entityName}: ${propertyName} must be a number`);
  }
};
