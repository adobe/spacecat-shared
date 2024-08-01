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

import AbstractHandler from './abstract.js';
import { hasText } from '@adobe/spacecat-shared-utils';
import { hashWithSHA256 } from '../generate-hash.js';
import AuthInfo from '../auth-info.js';

export default class ScopedApiKeyHandler extends AbstractHandler {
  constructor(log) {
    super('scopedApiKey', log);
  }

  async checkAuth(request, context) {
    const { dataAccess, pathInfo: { headers = [] }, log } = context;
    if (!dataAccess) {
      throw new Error('Data access required');
    }

    const apiKeyFromHeader = headers['x-api-key'];
    if (!hasText(apiKeyFromHeader)) {
      return null;
    }

    const hashedKey = hashWithSHA256(apiKeyFromHeader);
    const apiKeyEntity = await dataAccess.getApiKeyByHashedKey(hashedKey);

    if (!apiKeyEntity) {
      // No API key found in the DB
      return null;
    }

    const authInfo = new AuthInfo();
    // Check that the api key is still valid (not expired, or revoked)
    const now = new Date().toISOString();
    if (apiKeyEntity.getExpiresAt() < now) {
      this.log(`API key has expired, name: ${apiKeyEntity.getName()} id: ${apiKeyEntity.getId()}`, 'error');
      return authInfo.withReason('API key has expired');
    }

    if (apiKeyEntity.getRevokedAt() < now) {
      this.log(`API key has been revoked, name: ${apiKeyEntity.getName()} id: ${apiKeyEntity.getId()}`, 'error');
      return authInfo.withReason('API key has been revoked');
    }

    // TODO: set the profile based on the API key entity
    return authInfo;
  }
}
