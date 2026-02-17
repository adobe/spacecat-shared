/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {
  isNonEmptyObject, isNonEmptyArray, isString, hasText,
} from './functions.js';
import { OPPORTUNITY_TYPES } from './constants.js';

/** Expected properties on a suggestion's grants object (in-place grant storage). */
const GRANT_PROPERTIES = ['cycle', 'tokenId', 'grantedAt'];

const STATUS_NEW = 'NEW';

/**
 * Gets status from a suggestion (model instance or plain object).
 * @param {Object} suggestion - Suggestion model or plain object with status/getStatus().
 * @returns {string|undefined} Status value.
 */
function getSuggestionStatus(suggestion) {
  if (!suggestion) return undefined;
  return typeof suggestion.getStatus === 'function' ? suggestion.getStatus() : suggestion.status;
}

/**
 * Gets data from a suggestion (model instance or plain object).
 * @param {Object} suggestion - Suggestion model or plain object with data/getData().
 * @returns {Object|undefined} Suggestion data.
 */
function getSuggestionData(suggestion) {
  if (!suggestion) return undefined;
  return typeof suggestion.getData === 'function' ? suggestion.getData() : suggestion.data;
}

/**
 * Gets grants from a suggestion (model instance or plain object).
 * @param {Object} suggestion - Suggestion model or plain object with grants/getGrants().
 * @returns {Object|undefined} Grants object (cycle, tokenId, grantedAt) or undefined.
 */
function getSuggestionGrants(suggestion) {
  if (!suggestion) return undefined;
  return typeof suggestion.getGrants === 'function' ? suggestion.getGrants() : suggestion.grants;
}

/**
 * Returns true if the suggestion has a valid grant (unlocked).
 * The grants attribute must be present and contain the expected properties:
 * cycle, tokenId, grantedAt (each a non-empty string).
 *
 * @param {Object} suggestion - Suggestion model or plain object with grants/getGrants().
 * @returns {boolean} True if grants is present and has all required properties with values.
 */
export function isGranted(suggestion) {
  const grants = getSuggestionGrants(suggestion);
  if (!isNonEmptyObject(grants)) return false;
  return GRANT_PROPERTIES.every((key) => hasText(grants[key]));
}

/**
 * Returns true if a broken-backlinks suggestion has all required data to be complete.
 * Required: url_to, url_from (non-empty strings).
 *
 * @param {Object} data - Suggestion data object.
 * @returns {boolean}
 */
function isBrokenBacklinksComplete(data) {
  return (
    isString(data?.url_to) && data.url_to.trim() !== ''
    && isString(data?.url_from) && data.url_from.trim() !== ''
  );
}

/**
 * Returns true if a CWV suggestion has all required data to be complete.
 * For type 'url': requires url (non-empty string).
 * For type 'group': requires pattern (non-empty string).
 *
 * @param {Object} data - Suggestion data object.
 * @returns {boolean}
 */
function isCwvComplete(data) {
  const type = data?.type;
  if (type === 'url') {
    return isString(data?.url) && data.url.trim() !== '';
  }
  if (type === 'group') {
    return isString(data?.pattern) && data.pattern.trim() !== '';
  }
  return false;
}

/**
 * Returns true if an alt-text suggestion has all required data to be complete.
 * Required: non-empty recommendations array with each item having pageUrl (non-empty string).
 *
 * @param {Object} data - Suggestion data object.
 * @returns {boolean}
 */
function isAltTextComplete(data) {
  const recommendations = data?.recommendations;
  if (!isNonEmptyArray(recommendations)) return false;
  return recommendations.every(
    (rec) => isString(rec?.pageUrl) && rec.pageUrl.trim() !== '',
  );
}

const COMPLETE_HANDLERS = {
  [OPPORTUNITY_TYPES.BROKEN_BACKLINKS]: isBrokenBacklinksComplete,
  [OPPORTUNITY_TYPES.CWV]: isCwvComplete,
  [OPPORTUNITY_TYPES.ALT_TEXT]: isAltTextComplete,
};

/**
 * Returns whether a suggestion is complete.
 * A suggestion is complete when:
 * 1. Its status is NEW, and
 * 2. For the given opportunity type, it has all required data (type-specific logic).
 *
 * Supported opportunity types with handlers: broken-backlinks, cwv, alt-text.
 * For unsupported types, returns false.
 *
 * @param {Object} suggestion - Suggestion model or plain object (status/getStatus, data/getData).
 * @param {string} opportunityType - Opportunity type (e.g. BROKEN_BACKLINKS, CWV, ALT_TEXT).
 * @returns {boolean} True if the suggestion is complete (NEW + type-specific data valid).
 */
export function isSuggestionComplete(suggestion, opportunityType) {
  if (!suggestion || !opportunityType) return false;

  const status = getSuggestionStatus(suggestion);
  if (status !== STATUS_NEW) return false;

  const data = getSuggestionData(suggestion);
  if (!isNonEmptyObject(data)) return false;

  const handler = COMPLETE_HANDLERS[opportunityType];
  if (!handler) return false;

  return handler(data);
}

export {
  isBrokenBacklinksComplete,
  isCwvComplete,
  isAltTextComplete,
};
