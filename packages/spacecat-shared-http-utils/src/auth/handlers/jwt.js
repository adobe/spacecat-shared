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

/**
 * Reserved scope names produced ONLY from dedicated boolean / tenant claims (is_admin,
 * is_read_only_admin, the per-tenant fan-out below). These names must NEVER be sourced
 * from a payload-side `scopes[]` entry — otherwise an accidental future mint could
 * synthesise a privileged scope from a non-privileged token.
 *
 * Single source of truth for both the minter (spacecat-auth-service) and the consumer
 * (this handler). See SITES-46454 and
 * mysticat-architecture/platform/decisions/cross-product-sites-listing-via-client-id-scope.md.
 */
export const RESERVED_SCOPE_NAMES = Object.freeze(['admin', 'read_only_admin', 'user']);

/**
 * Allow-listed namespaces / exact names for payload-side `scopes[]` fan-out. Strings
 * outside this set are ignored at warn-level. The list grows by ADR amendment only —
 * adding a name here is a security-relevant change.
 */
export const ALLOWED_PAYLOAD_SCOPE_NAMES = Object.freeze([
  'sites:list:cross_product',
]);

/**
 * Returns true when `name` is an acceptable payload-side scope: present in the
 * allow-list AND not a reserved name. Defensive — the reserved-name check is redundant
 * if the allow-list is curated, but it guarantees correctness even if a maintainer
 * mistakenly adds a reserved name to ALLOWED_PAYLOAD_SCOPE_NAMES.
 */
function isAllowedPayloadScopeName(name) {
  return typeof name === 'string'
    && ALLOWED_PAYLOAD_SCOPE_NAMES.includes(name)
    && !RESERVED_SCOPE_NAMES.includes(name);
}

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
        this.log('Token has both is_admin and is_read_only_admin - rejecting', 'warn');
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

      /*
       * Fan out payload-side `scopes[]` strings into first-class AuthInfo scopes
       * (SITES-46454). The JWT signature is already verified above via validateToken,
       * so any entry here was minted by spacecat-auth-service — the consumer cannot
       * forge scopes. The discipline below is shape hygiene:
       *
       *  - Only names in ALLOWED_PAYLOAD_SCOPE_NAMES are mapped.
       *  - RESERVED_SCOPE_NAMES (admin / read_only_admin / user) are never sourced
       *    from payload.scopes[]; those scopes come exclusively from the dedicated
       *    boolean / tenant claims handled above.
       *  - Unknown / disallowed entries are dropped and logged at warn so an
       *    accidental future mint is visible, not silent.
       */
      if (Array.isArray(payload.scopes)) {
        for (const scopeName of payload.scopes) {
          if (isAllowedPayloadScopeName(scopeName)) {
            scopes.push({ name: scopeName });
          } else {
            this.log(`[jwt] ignoring unknown payload scope: ${JSON.stringify(scopeName)}`, 'warn');
          }
        }
      }

      if (context.s2sConsumer) {
        this.log(`[jwt] S2S consumer ${context.s2sConsumer?.getClientId()} token used on route ${context.pathInfo?.method} ${context.pathInfo?.suffix}`, 'info');
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
