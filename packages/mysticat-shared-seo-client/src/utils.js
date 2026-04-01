/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Merges default query parameters with caller-provided overrides.
 * @param {object} defaults - Default parameter values
 * @param {object} overrides - Caller-provided overrides
 * @returns {object} Merged parameters
 */
export function buildQueryParams(defaults, overrides) {
  return { ...defaults, ...overrides };
}

/**
 * Parses/normalizes an API response.
 * Stub - passes through unchanged. To be extended when implementing API calls.
 * @param {*} response - Raw API response
 * @returns {*} Parsed response
 */
export function parseResponse(response) {
  return response;
}
