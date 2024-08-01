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

import { Response } from '@adobe/fetch';

import { hasText } from '@adobe/spacecat-shared-utils';
import AuthenticationManager from './authentication-manager.js';
import { hashWithSHA256 } from './generate-hash.js';

const ANONYMOUS_ENDPOINTS = [
  'GET /slack/events',
  'POST /slack/events',
];

export function authWrapper(fn, opts = {}) {
  let authenticationManager;

  /**
   * @param {DataAccess} context.dataAccess - Data access.
   */
  return async (request, context) => {
    const { log, pathInfo: { method, suffix } } = context;

    const route = `${method.toUpperCase()} ${suffix}`;

    if (ANONYMOUS_ENDPOINTS.includes(route)
        || route.startsWith('POST /hooks/site-detection/')
        || method.toUpperCase() === 'OPTIONS') {
      return fn(request, context);
    }

    if (!authenticationManager) {
      if (!Array.isArray(opts.authHandlers)) {
        log.error('Invalid auth handlers');
        return new Response('Server error', { status: 500 });
      }

      authenticationManager = AuthenticationManager.create(opts.authHandlers, log);
    }

    try {
      await authenticationManager.authenticate(request, context);
    } catch (error) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!context.auth) {
      context.auth = {
        hasScopes: async (scopes) => {
          // Pull the api-key from x-api-key header
          const apiKeyFromHeader = context.pathInfo?.headers['x-api-key'];

          if (!hasText(apiKeyFromHeader)) {
            return new Response('Unauthorized', { status: 401 });
          }

          // Generate a hash of the API Key
          const hashedKey = hashWithSHA256(apiKeyFromHeader);

          if (!context.dataAccess) {
            log.error('Data access required');
            return new Response('Server error', { status: 500 });
          }

          // Fetch the api-key record from data access layer
          const apiKeyRecord = await context.dataAccess.getApiKeyByHashedKey(hashedKey);

          // Check that the api key has not expired or been revoked,
          const now = new Date().toISOString();
          if (apiKeyRecord.getExpiresAt() < now) {
            log.error(`API key has expired, name = ${apiKeyRecord.getName()}`);
            return new Response('Unauthorized', { status: 401 });
          }

          if (apiKeyRecord.getRevokedAt() < now) {
            log.error(`API key has been revoked, name = ${apiKeyRecord.getName()}`);
            return new Response('Unauthorized', { status: 401 });
          }
          // Iterate over scopes and check if the record has all the scopes
          return scopes.every((scope) => apiKeyRecord.getScopes().includes(scope));
        },
      };
    }

    return fn(request, context);
  };
}
