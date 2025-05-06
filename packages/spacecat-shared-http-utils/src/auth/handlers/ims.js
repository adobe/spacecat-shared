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

import { hasText } from '@adobe/spacecat-shared-utils';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from 'jose';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';
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

const SERVICE_CODE = 'dx_aem_perf';
const loadConfig = (context) => {
  try {
    const config = JSON.parse(context.env.AUTH_HANDLER_IMS);
    context.log.info(`Loaded config name: ${config.name}`);
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

  static #getTenants(profile, organizations) {
    const contexts = profile.projectedProductContext;
    if (!Array.isArray(contexts) || contexts.length === 0) {
      return [];
    }

    const filteredContexts = contexts
      .filter((context) => context.prodCtx.serviceCode === SERVICE_CODE)
      // remove duplicates
      .filter((context, index, array) => array.findIndex(
        (tenant) => (context.prodCtx.owningEntity
          && tenant.prodCtx.owningEntity === context.prodCtx.owningEntity),
      ) === index)
      // remove the auth source from the id (<id>@<auth-src>)
      .map((context) => ({
        id: context.prodCtx.owningEntity.split('@')[0],
        subServices: context.prodCtx.enable_sub_service?.split(',').filter((subService) => subService.startsWith(SERVICE_CODE)),
      }));

    return organizations.filter(
      (org) => filteredContexts.findIndex((ctx) => ctx.id === org.orgRef.ident) !== -1,
    ).map((org) => ({
      id: org.orgRef.ident,
      name: org.orgName,
      subServices: filteredContexts.find((ctx) => ctx.id === org.orgRef.ident)?.subServices,
    }));
  }

  async #validateToken(token, config) {
    const claims = await decodeJwt(token);
    if (config.name !== claims.as) {
      throw new Error(`Token not issued by expected idp: ${config.name} != ${claims.as}`);
    }

    const imsProfile = await ImsClient.getImsUserProfile(token);
    const organizations = await ImsClient.getImsUserOrganizations(token);

    const tenants = AdobeImsHandler.#getTenants(imsProfile, organizations);

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
    payload.tenants = tenants || [];

    return payload;
  }

  async checkAuth(request, context) {
    const token = getBearerToken(context);
    if (!hasText(token)) {
      this.log('No bearer token provided', 'debug');
      return null;
    }

    try {
      const config = loadConfig(context);
      const payload = await this.#validateToken(token, config);
      const profile = transformProfile(payload);

      const scopes = [{ name: 'admin' }];

      if (!profile.email?.endsWith('@adobe.com')) {
        scopes.push(...payload.tenants.map(
          (tenant) => ({ name: 'user', domains: [tenant.id], subScopes: tenant.subServices }),
        ));
      }

      return new AuthInfo()
        .withType(this.name)
        .withAuthenticated(true)
        .withProfile(profile)
        .withScopes(scopes);
    } catch (e) {
      this.log(`Failed to validate token: ${e.message}`, 'error');
    }

    return null;
  }
}
