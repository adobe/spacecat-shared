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

/**
 * Check if the given AuthInfo has the required scopes.
 * @param {Array<string>} scopes - The scopes required for the request
 * @param {AuthInfo} authInfo - Authentication state for the current request
 * @param {Logger} log - Logger
 * @return {{result: boolean, reason?: string}}
 */
export function hasScopes(scopes, authInfo, log) {
  if (!authInfo) {
    throw new Error('Auth info is required');
  }

  // Check that each required scope is present in authInfo
  const missingScopes = [];
  const authInfoScopeNames = authInfo.getScopes().map((scopeObject) => scopeObject.name);
  scopes.forEach((scope) => {
    if (!authInfoScopeNames.includes(scope)) {
      missingScopes.push(scope);
    }
  });

  if (missingScopes.length > 0) {
    log.error(`API key with ID: ${authInfo.getProfile()?.api_key_id} does not have required scopes. It's missing: ${missingScopes.join(',')}`);
    return {
      result: false,
      reason: `API key is missing the [${missingScopes.join(',')}] scope(s) required for this resource`,
    };
  }

  return { result: true };
}
