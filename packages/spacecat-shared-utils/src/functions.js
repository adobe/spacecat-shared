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

import isEmail from 'validator/lib/isEmail.js';
import { parse } from 'tldts';

// Precompile regular expressions
const REGEX_ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
const REGEX_TIME_OFFSET_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}(Z|[+-]\d{2}:\d{2})/;
const IMS_ORG_ID_REGEX = /[a-z0-9]{24}@AdobeOrg/i;
const UUID_V4_REGEX = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;

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
 * Determines whether the given value is a non-empty array (length greater than zero).
 * @param {*} value - The value to check.
 * @return {boolean} True if the value is a non-empty array, false otherwise.
 */
function isNonEmptyArray(value) {
  return isArray(value) && value.length > 0;
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
  return value !== null && typeof value === 'object' && !isArray(value);
}

/**
 * Checks if the given value is an object and contains properties of its own.
 * @param {*} value - The value to check.
 * @return {boolean} True if the value is a non-empty object, false otherwise.
 */
function isNonEmptyObject(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

/**
 * Deeply compares two objects or arrays for equality. Supports nested objects and arrays.
 * Does not support circular references. Does not compare functions.
 * @param {unknown} x - The first object or array to compare.
 * @param {unknown} y - The second object or array to compare.
 * @return {boolean} True if the objects or arrays are equal, false otherwise.
 */
function deepEqual(x, y) {
  if (x === y) return true;

  if (isArray(x) && isArray(y)) {
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i += 1) {
      if (!deepEqual(x[i], y[i])) return false;
    }
    return true;
  }

  if (!isObject(x) || !isObject(y)) return false;

  if (x.constructor !== y.constructor) return false;

  if (x instanceof Date) return x.getTime() === y.getTime();
  if (x instanceof RegExp) return x.toString() === y.toString();

  const xKeys = Object.keys(x).filter((key) => typeof x[key] !== 'function');
  const yKeys = Object.keys(y).filter((key) => typeof y[key] !== 'function');

  if (xKeys.length !== yKeys.length) return false;

  for (const key of xKeys) {
    if (!Object.prototype.hasOwnProperty.call(y, key) || !deepEqual(x[key], y[key])) return false;
  }

  return true;
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
  } catch {
    return false;
  }
}

/**
 * Validates whether the given string is a valid BaseURL with http or https protocol.
 * Validates that the URL is clean: no explicit ports, hash fragments, or query parameters.
 * Paths are allowed.
 *
 * @param {string} urlString - The string to validate.
 * @returns {boolean} True if the given string validates successfully.
 */
function isValidBaseUrl(urlString) {
  try {
    let url = urlString.trim();

    // reject control characters (LF, CR, etc.)
    if ([...url].some((c) => {
      const code = c.charCodeAt(0);
      return code < 32 || code === 127;
    })) return false;

    const hasProtocol = /^[a-z][a-z0-9+\-.]*:\/\//i.test(url);
    if (!hasProtocol) {
      url = `https://${url}`;
    }

    const urlObj = new URL(url);

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return false;
    if (urlObj.search || urlObj.hash || urlObj.port) return false;
    if (urlObj.username || urlObj.password) return false;
    if (urlObj.pathname.includes('..') || urlObj.pathname.includes('//')) return false;

    // ensure the hostname is a valid registrable domain and not an IP
    const domain = parse(urlObj.hostname, { allowPrivateDomains: true });
    if (!domain.domain || domain.isIp) return false;
    if (!domain.isIcann && !domain.isPrivate) return false;

    // validate each label for length and allowed characters
    for (const label of urlObj.hostname.split('.')) {
      if (label.length === 0 || label.length > 63) return false;
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether the given string is a valid UUID.
 * @param {string} uuid - The string to validate.
 * @return {boolean} True if the given string is a valid UUID.
 */
function isValidUUID(uuid) {
  return UUID_V4_REGEX.test(uuid);
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
 * @param {string=} dateString - The reference date in string format.
 * @returns {Date} A new Date object representing the calculated date after the specified days.
 * @throws {TypeError} If the provided 'days' parameter is not a number.
 * @throws {RangeError} If the calculated date is outside the valid JavaScript date range.
 *
 * @example
 * // Get the date 7 days from now
 * const sevenDaysLater = dateAfterDays(7);
 * console.log(sevenDaysLater); // Outputs a Date object representing the date 7 days from now
 */
function dateAfterDays(days, dateString) {
  const currentDate = !dateString ? new Date() : new Date(dateString);
  currentDate.setUTCDate(currentDate.getDate() + days);
  return currentDate;
}

/**
 * Validates whether the given string is a valid IMS Org ID.
 * @param {string} imsOrgId - The string to validate.
 * @returns {boolean} True if the given string is a valid IMS Org ID, false otherwise.
 */
function isValidIMSOrgId(imsOrgId) {
  return IMS_ORG_ID_REGEX.test(imsOrgId);
}

/**
 * Validates whether the given string is a valid email address.
 * @param {string} email - The string to validate.
 * @returns {boolean} True if the given string is a valid email address, false otherwise.
 */
function isValidEmail(email) {
  return typeof email === 'string' && isEmail(email);
}

/**
 * Validates whether the given string is a valid Helix preview URL.
 * Preview URLs have the format: https://ref--site--owner.domain
 * where domain is typically .hlx.page, .aem.page, .hlx.live, etc.
 *
 * @param {string} urlString - The string to validate.
 * @returns {boolean} True if the given string is a valid Helix preview URL.
 */
function isValidHelixPreviewUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') {
      return false;
    }

    const parts = url.hostname.split('.');
    if (parts.length < 2) {
      return false;
    }

    // making 3 parts: ref--site--owner
    const subdomain = parts[0];
    const subdomainParts = subdomain.split('--');

    if (subdomainParts.length !== 3) {
      return false;
    }

    if (subdomainParts.some((part) => !part || part.trim() === '')) {
      return false;
    }

    const domain = parts.slice(1).join('.');
    const validDomains = [
      'hlx.page',
      'hlx.live',
      'aem.page',
      'aem.live',
    ];

    return validDomains.includes(domain);
  } catch {
    return false;
  }
}

export {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidEmail,
  isValidUrl,
  isValidBaseUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
};
