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
import { hashWithSHA256 } from './generate-hash.js';

/**
 * Check if the given API key has the required scopes
 * @param scopes
 * @param apiKey
 * @param dataAccess
 * @param log
 * @return {Promise<boolean|{result: boolean, reason: string}>}
 */
export async function hasScopes(scopes, apiKey, dataAccess, log) {
// Generate a hash of the API Key
  const hashedKey = hashWithSHA256(apiKey);

  if (!dataAccess) {
    throw new Error('Data access required');
  }

  // Fetch the api-key record from data access layer
  const apiKeyRecord = await dataAccess.getApiKeyByHashedKey(hashedKey);

  if (!apiKeyRecord) {
    log.error('API key not found for the given hashed key');
    return { result: false, reason: 'API key not found' };
  }

  // Check that the api key has not expired or been revoked,
  const now = new Date().toISOString();
  if (apiKeyRecord.getExpiresAt() < now) {
    log.error(`API key has expired, name = ${apiKeyRecord.getName()}, id = ${apiKeyRecord.getId()}`);
    return { result: false, reason: 'API key has expired' };
  }

  if (apiKeyRecord.getRevokedAt() < now) {
    log.error(`API key has been revoked, name = ${apiKeyRecord.getName()}, id = ${apiKeyRecord.getId()}`);
    return { result: false, reason: 'API key has been revoked' };
  }
  // Iterate over scopes and check if the record has all the scopes
  const missingScopes = [];
  scopes.forEach((scope) => {
    if (!apiKeyRecord.getScopes().includes(scope)) {
      missingScopes.push(scope);
    }
  });
  if (missingScopes.length > 0) {
    log.error(`API key does not have required scopes, missing scopes = ${missingScopes.join(',')}`);
    return { result: false, reason: `API key is missing the [${missingScopes.join(',')}] scope(s) required for this resource` };
  }
  return true;
}
