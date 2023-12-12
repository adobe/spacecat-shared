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

// Precompile regular expressions
const REGEX_ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
const REGEX_TIME_OFFSET_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}(Z|[+-]\d{2}:\d{2})/;

/**
 * Determines if the given parameter is an array.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the parameter is an array, false otherwise.
 */
function isArray(value) {
  return Array.isArray(value);
}

/**
 * Determines case-insensitively if the given value is a boolean or a string
 * representation of a boolean.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a boolean or a string representation of a boolean.
 */
function isBoolean(value) {
  const lowerCaseValue = String(value).toLowerCase();
  return typeof value === 'boolean' || lowerCaseValue === 'true' || lowerCaseValue === 'false';
}

/**
 * Checks if the given value is an integer.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is an integer, false otherwise.
 */
function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Determines if the given value is a number.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a finite number, false otherwise.
 */
function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Checks if the given parameter is an object and not an array or null.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the parameter is an object, false otherwise.
 */
function isObject(value) {
  return !isArray(value) && value !== null && typeof value === 'object';
}

/**
 * Determines if the given parameter is a string.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the parameter is a string, false otherwise.
 */
function isString(value) {
  return (!!value || value === '') && typeof value === 'string';
}

/**
 * Checks if the given string is not empty.
 *
 * @param {*} str - The string to check.
 * @returns {boolean} True if the string is not empty, false otherwise.
 */
function hasText(str) {
  return !!str && isString(str);
}

/**
 * Checks whether the given object is a valid JavaScript Date.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the given object is a valid Date object, false otherwise.
 */
function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Validates whether the given string is a JavaScript ISO date string in
 * Zulu (UTC) timezone. Used for persisting system dates, which must be
 * independent of any user timezone.
 *
 * @param {string} str - The string to validate.
 * @returns {boolean} True if the given string validates successfully.
 */
function isIsoDate(str) {
  if (!REGEX_ISO_DATE.test(str)) {
    return false;
  }

  const date = new Date(str);
  return isValidDate(date) && date.toISOString() === str;
}

/**
 * Validates whether the given string is a JavaScript ISO date string
 * following UTC time offsets format.
 *
 * @param {string} str - The string to validate.
 * @returns {boolean} True if the given string validates successfully.
 */
function isIsoTimeOffsetsDate(str) {
  return REGEX_TIME_OFFSET_DATE.test(str);
}

/**
 * Validates whether the given string is a valid URL with http or https protocol.
 *
 * @param {string} urlString - The string to validate.
 * @returns {boolean} True if the given string validates successfully.
 */
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Converts a given value to a boolean. Throws an error if the value is not a boolean.
 *
 * @param {*} value - The value to convert.
 * @returns {boolean} The converted boolean value.
 * @throws {Error} If the value is not a boolean or a boolean-like string.
 */
function toBoolean(value) {
  if (!isBoolean(value)) {
    throw new Error('Not a boolean value');
  }
  return JSON.parse(String(value).toLowerCase());
}

/**
 * Compares two arrays for equality. Supports primitive array item types only.
 *
 * @param {Array} a - The first array to compare.
 * @param {Array} b - The second array to compare.
 * @returns {boolean} True if the arrays are equal, false otherwise.
 */
const arrayEquals = (a, b) => isArray(a)
  && isArray(b)
  && a.length === b.length
  && a.every((val, index) => val === b[index]);

/**
 * Calculates the date after a specified number of days from the current date.
 *
 * @param {number} days - The number of days to add to the current date.
 * @returns {Date} A new Date object representing the calculated date after the specified days.
 * @throws {TypeError} If the provided 'days' parameter is not a number.
 * @throws {RangeError} If the calculated date is outside the valid JavaScript date range.
 *
 * @example
 * // Get the date 7 days from now
 * const sevenDaysLater = dateAfterDays(7);
 * console.log(sevenDaysLater); // Outputs a Date object representing the date 7 days from now
 */
function dateAfterDays(days) {
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + days);
  return currentDate;
}

export {
  arrayEquals,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isValidDate,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNumber,
  isObject,
  isString,
  toBoolean,
  isValidUrl,
  dateAfterDays,
};
