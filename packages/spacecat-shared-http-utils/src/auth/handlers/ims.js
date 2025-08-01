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

import { hasText, isNonEmptyArray } from '@adobe/spacecat-shared-utils';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from 'jose';
import { getBearerToken } from './utils/bearer.js';
import AbstractHandler from './abstract.js';
import AuthInfo from '../auth-info.js';

const IGNORED_PROFILE_PROPS = [
  'id',
  'type',
  'as_id',
  'ctp',
  'pac',
  'rtid',
  'moi',
  'rtea',
  'user_id',
  'fg',
  'aa_id',
];

const ADMIN_GROUP_IDENT = {
  '8C6043F15F43B6390A49401A': [ // IMS admin group for stag
    635541219,
  ],
  '908936ED5D35CC220A495CD4': [
    879529884, // IMS admin group for prod
    901092291, // IMS admin group for on call engineers
  ],
};
const SERVICE_CODE = 'dx_aem_perf';
const loadConfig = (context) => {
  try {
    const config = JSON.parse(context.env.AUTH_HANDLER_IMS);
    context.log.debug(`Loaded config name: ${config.name}`);
    return config;
  } catch (e) {
    context.log.error(`Failed to load config from context: ${e.message}`);
    throw Error('Failed to load config from context');
  }
};

const transformProfile = (payload) => {
  const profile = { ...payload };

  profile.email = payload.user_id;
  IGNORED_PROFILE_PROPS.forEach((prop) => delete profile[prop]);

  return profile;
};

function getTenants(organizations) {
  if (!isNonEmptyArray(organizations)) {
    return [];
  }

  return organizations.map((org) => ({
    id: org.orgRef.ident,
    name: org.orgName,
    subServices: [`${SERVICE_CODE}_auto_suggest`, `${SERVICE_CODE}_auto_fix`],
  }));
}

function isUserASOAdmin(organizations) {
  if (!organizations) {
    throw new Error('organizations param is required.');
  }

  return organizations.some((org) => {
    const adminGroupsForOrg = ADMIN_GROUP_IDENT[org.orgRef.ident];
    if (!adminGroupsForOrg) {
      return false;
    }
    return org.groups.some((group) => adminGroupsForOrg.includes(group.ident));
  });
}
/**
 * @deprecated Use JwtHandler instead in the context of IMS login with subsequent JWT exchange.
 */
export default class AdobeImsHandler extends AbstractHandler {
  constructor(log) {
    super('ims', log);
    this.jwksCache = null;
  }

  async #getJwksUri(config) {
    if (!this.jwksCache) {
      /* c8 ignore next 3 */
      this.jwksCache = config.discovery.jwks
        ? createLocalJWKSet(config.discovery.jwks)
        : createRemoteJWKSet(new URL(config.discovery.jwks_uri));
    }

    return this.jwksCache;
  }

  async #validateToken(token, config) {
    const claims = await decodeJwt(token);
    if (config.name !== claims.as) {
      throw new Error(`Token not issued by expected idp: ${config.name} != ${claims.as}`);
    }

    const jwks = await this.#getJwksUri(config);
    const { payload } = await jwtVerify(token, jwks);

    const now = Date.now();
    const expiresIn = Number.parseInt(payload.expires_in, 10);
    const createdAt = Number.parseInt(payload.created_at, 10);

    if (Number.isNaN(expiresIn) || Number.isNaN(createdAt)) {
      throw new Error('expires_in and created_at claims must be numbers');
    }

    if (createdAt >= now) {
      throw new Error('created_at should be in the past');
    }

    const ttl = Math.floor((createdAt + expiresIn - now) / 1000);
    if (ttl <= 0) {
      throw new Error('token expired');
    }

    payload.ttl = ttl;

    return payload;
  }

  async checkAuth(request, context) {
    const token = getBearerToken(context);
    if (!hasText(token)) {
      this.log('No bearer token provided', 'debug');
      return null;
    }

    if (!context.imsClient) {
      this.log('No IMS client available in context', 'error');
      return null;
    }

    try {
      const config = loadConfig(context);
      const payload = await this.#validateToken(token, config);
      const imsProfile = await context.imsClient.getImsUserProfile(token);
      const organizations = await context.imsClient.getImsUserOrganizations(token);
      const isAdmin = isUserASOAdmin(organizations);
      const scopes = [];
      if (imsProfile.email?.toLowerCase().endsWith('@adobe.com') && isAdmin) {
        scopes.push({ name: 'admin' });
      } else {
        payload.tenants = getTenants(organizations) || [];
        scopes.push(...payload.tenants.map(
          (tenant) => ({ name: 'user', domains: [tenant.id], subScopes: tenant.subServices }),
        ));
      }
      const profile = transformProfile(payload);

      return new AuthInfo()
        .withType(this.name)
        .withAuthenticated(true)
        .withProfile(profile)
        .withScopes(scopes);
    } catch (e) {
      this.log(`Failed to validate token: ${e.message}`, 'debug');
    }

    return null;
  }
}
