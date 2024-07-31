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

import {
  hasText, isIsoDate, isObject, isValidUrl,
} from '@adobe/spacecat-shared-utils';
import { Base } from './base.js';

const scopeNames = ['sites.read_all', 'sites.write_all', 'organizations.read_all', 'organizations.write_all',
  'audits.read_all', 'audits.write_all', 'imports.read', 'imports.write', 'imports.read_all'];
const ApiKey = (data) => {
  const self = Base(data);

  self.getHashedKey = () => self.state.hashedKey;
  self.getName = () => self.state.name;
  self.getImsUserId = () => self.state.imsUserId;
  self.getImsOrgId = () => self.state.imsOrgId;
  self.getCreatedAt = () => self.state.createdAt;
  self.getExpiresAt = () => self.state.expiresAt;
  self.getRevokedAt = () => self.state.revokedAt;
  self.getScopes = () => self.state.scopes;

  return Object.freeze(self);
};

/**
 * Creates a new ApiKey object.
 * @param {Object} apiKeyData - The data for the ApiKey object.
 * @returns {ApiKey} The new ApiKey object.
 */
export const createApiKey = (data) => {
  const newState = { ...data };

  if (!hasText(newState.hashedKey)) {
    throw new Error(`Invalid Hashed Key: ${newState.hashedKey}`);
  }

  if (!hasText(newState.name)) {
    throw new Error(`Invalid Name: ${newState.name}`);
  }

  if (hasText(newState.createdAt) && !isIsoDate(newState.createdAt)) {
    throw new Error(`createdAt should be a valid ISO 8601 string: ${newState.createdAt}`);
  }

  if (!hasText(newState.createdAt)) {
    newState.createdAt = new Date().toISOString();
  }

  if (hasText(newState.expiresAt) && !isIsoDate(newState.expiresAt)) {
    throw new Error(`expiresAt should be a valid ISO 8601 string: ${newState.expiresAt}`);
  }

  if (hasText(newState.revokedAt) && !isIsoDate(newState.revokedAt)) {
    throw new Error(`revokedAt should be a valid ISO 8601 string: ${newState.revokedAt}`);
  }

  if (!Array.isArray(newState.scopes)) {
    throw new Error(`Invalid scopes: ${newState.scopes}`);
  }

  for (const scope of newState.scopes) {
    if (!isObject(scope)) {
      throw new Error(`Invalid scope: ${scope}`);
    }

    if (!hasText(scope.name)) {
      throw new Error(`Invalid scope name: ${scope.name}`);
    }

    if (!scopeNames.includes(scope.name)) {
      throw new Error(`Scope name is not part of the pre-defined scopes: ${scope.name}`);
    }

    if (hasText(scope.domains) && !Array.isArray(scope.domains)) {
      throw new Error(`Scope domains should be an array: ${scope.domains}`);
    }
    for (const domain of scope.domains) {
      if (!isValidUrl(domain)) {
        throw new Error(`Invalid domain: ${domain}`);
      }
    }
  }

  return ApiKey(newState);
};
