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

import { hasText } from '@adobe/spacecat-shared-utils';

import AbstractHandler from './abstract.js';
import AuthInfo from '../auth-info.js';
import { getBearerToken } from './utils/bearer.js';
import { getCookieValue } from './utils/cookie.js';
import { loadPublicKey, validateToken } from './utils/token.js';

export { ISSUER } from './utils/token.js';

export default class JwtHandler extends AbstractHandler {
  constructor(log) {
    super('jwt', log);
  }

  async checkAuth(request, context) {
    try {
      if (!this.authPublicKey) {
        this.authPublicKey = await loadPublicKey(context);
      }

      const token = getBearerToken(context) ?? getCookieValue(context, 'sessionToken');

      if (!hasText(token)) {
        this.log('No bearer token provided', 'debug');
        return null;
      }

      const payload = await validateToken(token, this.authPublicKey);
      payload.tenants = payload.tenants || [];

      if (payload.is_admin && payload.is_read_only_admin) {
        this.log('Token has both is_admin and is_read_only_admin — rejecting', 'warn');
        return null;
      }

      const scopes = [];
      if (payload.is_admin) {
        scopes.push({ name: 'admin' });
      } else if (payload.is_read_only_admin) {
        scopes.push({ name: 'read_only_admin' });
      }

      scopes.push(...payload.tenants.map(
        (tenant) => ({
          name: 'user', domains: [tenant.id], subScopes: tenant?.subServices || [], entitlement: tenant?.entitlement || {},
        }),
      ));

      if (context.s2sConsumer) {
        this.log(`[jwt] S2S consumer token used on route ${context.pathInfo?.method} ${context.pathInfo?.suffix}`, 'info');
      }

      return new AuthInfo()
        .withType(this.name)
        .withAuthenticated(true)
        .withProfile(payload)
        .withScopes(scopes);
    } catch (e) {
      this.log(`Failed to validate token: ${e.message}`, 'debug');
    }

    return null;
  }
}
