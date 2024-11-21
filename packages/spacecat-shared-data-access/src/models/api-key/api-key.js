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
import { Base } from '../base.js';

// List of known scope names that can be used with scoped API keys
const scopeNames = [
  'sites.read_all',
  'sites.write_all',
  'organizations.read_all',
  'organizations.write_all',
  'audits.read_all',
  'audits.write_all',
  'imports.read',
  'imports.write',
  'imports.delete',
  'imports.read_all',
  'imports.all_domains',
  'imports.assistant',
];

const ApiKey = (data) => {
  const self = Base(data);

  self.getHashedApiKey = () => self.state.hashedApiKey;
  self.getName = () => self.state.name;
  self.getImsUserId = () => self.state.imsUserId;
  self.getImsOrgId = () => self.state.imsOrgId;
  self.getCreatedAt = () => self.state.createdAt;
  self.getExpiresAt = () => self.state.expiresAt;
  self.getRevokedAt = () => self.state.revokedAt;
  self.getDeletedAt = () => self.state.deletedAt;
  self.getScopes = () => self.state.scopes;

  /**
   * Checks if the apiKey is valid.
   * @returns {boolean} True if the apiKey is valid, false otherwise
   */
  self.isValid = () => {
    const now = new Date();

    if (self.state.deletedAt && new Date(self.state.deletedAt) < now) {
      return false;
    }

    if (self.state.revokedAt && new Date(self.state.revokedAt) < now) {
      return false;
    }

    if (self.state.expiresAt && new Date(self.state.expiresAt) < now) {
      return false;
    }

    return true;
  };

  /**
   * Updates the state of the ApiKey.
   * @param key - The key to update.
   * @param value - The new value.
   * @param validator - An optional validation function to use before updating the value.
   * @returns {ApiKey} The updated ApiKey object.
   */
  const updateState = (key, value, validator) => {
    if (validator && typeof validator === 'function') {
      validator(value);
    }

    self.state[key] = value;
    self.touch();

    return self;
  };

  /**
   * Updates the deletedAt attribute of the ApiKey.
   * @param {string} deletedAt - The deletedAt timestamp - ISO 8601 date string.
   */
  self.updateDeletedAt = (deletedAt) => updateState('deletedAt', deletedAt, (value) => {
    if (!isIsoDate(value)) {
      throw new Error(`Invalid deletedAt during update: ${value}. Must be a valid ISO 8601 date string.`);
    }
  });

  /**
   * Updates the expiresAt attribute of the ApiKey.
   * @param {string} expiresAt - The expiresAt timestamp - ISO 8601 date string.
   */
  self.updateExpiresAt = (expiresAt) => updateState('expiresAt', expiresAt, (value) => {
    if (!isIsoDate(value)) {
      throw new Error(`Invalid expiresAt during update: ${value}. Must be a valid ISO 8601 date string.`);
    }
  });

  /**
   * Updates the revokedAt attribute of the ApiKey.
   * @param {string} revokedAt - The revokedAt timestamp - ISO 8601 date string.
   */
  self.updateRevokedAt = (revokedAt) => updateState('revokedAt', revokedAt, (value) => {
    if (!isIsoDate(value)) {
      throw new Error(`Invalid revokedAt during update: ${value}. Must be a valid ISO 8601 date string.`);
    }
  });

  return Object.freeze(self);
};

/**
 * Creates a new ApiKey object.
 * @param {Object} apiKeyData - The data for the ApiKey object.
 * @returns {ApiKey} The new ApiKey object.
 */
export const createApiKey = (apiKeyData) => {
  const newState = { ...apiKeyData };

  if (!hasText(newState.hashedApiKey)) {
    throw new Error(`Invalid Hashed API Key: ${newState.hashedApiKey}`);
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

    if (scope.domains) {
      if (!Array.isArray(scope.domains)) {
        throw new Error(`Scope domains should be an array: ${scope.domains}`);
      }
      for (const domain of scope.domains) {
        if (!isValidUrl(domain)) {
          throw new Error(`Invalid domain: ${domain}`);
        }
      }
    }
  }

  return ApiKey(newState);
};
