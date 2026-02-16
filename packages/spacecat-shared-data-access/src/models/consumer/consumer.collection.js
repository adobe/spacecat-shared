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

import { hasText, isNonEmptyArray } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import ValidationError from '../../errors/validation.error.js';
import Consumer from './consumer.model.js';

/**
 * ConsumerCollection - A collection class responsible for managing Consumer entities.
 * Extends the BaseCollection to provide specific methods for interacting with Consumer records.
 *
 * @class ConsumerCollection
 * @extends BaseCollection
 */
class ConsumerCollection extends BaseCollection {
  static COLLECTION_NAME = 'ConsumerCollection';

  #validCapabilities = null;

  /**
   * Returns the set of valid capabilities, generated dynamically from all registered
   * entity names and operations. Computed once and cached.
   * Format: entityName:operation (e.g. "site:read", "organization:write")
   * @returns {Set<string>} - The set of valid capability strings.
   * @private
   */
  #getValidCapabilities() {
    if (!this.#validCapabilities) {
      const entityNames = this.entityRegistry.getEntityNames();
      this.#validCapabilities = new Set(
        entityNames.flatMap(
          (name) => Consumer.CAPABILITIES.map((op) => `${name}:${op}`),
        ),
      );
    }
    return this.#validCapabilities;
  }

  /**
   * Validates that all capabilities in the given array are known entity:operation pairs.
   * @param {string[]} capabilities - The capabilities to validate.
   * @throws {ValidationError} - Throws if any capability is not recognized.
   * @private
   */
  #validateCapabilities(capabilities) {
    if (!isNonEmptyArray(capabilities)) {
      return;
    }

    const validCapabilities = this.#getValidCapabilities();
    const invalid = capabilities.filter((cap) => !validCapabilities.has(cap));

    if (invalid.length > 0) {
      throw new ValidationError(
        `Invalid capabilities: [${invalid.join(', ')}]`,
        this,
      );
    }
  }

  /**
   * Validates that the given imsOrgId is in the allowed list from config.
   * @param {string} imsOrgId - The IMS Org ID to validate.
   * @throws {ValidationError} - Throws if the imsOrgId is not in the allowed list.
   * @private
   */
  #validateImsOrgId(imsOrgId) {
    const { s2sAllowedImsOrgIds } = this.entityRegistry.config;

    if (!isNonEmptyArray(s2sAllowedImsOrgIds)) {
      throw new ValidationError(
        'S2S_ALLOWED_IMS_ORG_IDS is not configured. Cannot create a consumer without an allowlist.',
        this,
      );
    }

    if (!s2sAllowedImsOrgIds.includes(imsOrgId)) {
      throw new ValidationError(
        `The imsOrgId "${imsOrgId}" is not in the list of allowed IMS Org IDs`,
        this,
      );
    }
  }

  /**
   * Validates that no existing consumer has the same clientId.
   * @param {string} clientId - The clientId to check.
   * @throws {ValidationError} - Throws if a consumer with this clientId already exists.
   * @private
   */
  async #validateClientIdUniqueness(clientId) {
    if (!hasText(clientId)) {
      throw new ValidationError(
        'clientId is required to create a consumer',
        this,
      );
    }

    const existing = await this.findByClientId(clientId);
    if (existing) {
      throw new ValidationError(
        `A consumer with clientId "${clientId}" already exists`,
        this,
      );
    }
  }

  /**
   * Creates a new Consumer entity after validating imsOrgId, capabilities, and clientId uniqueness.
   * @param {Object} item - The data for the entity to be created.
   * @param {Object} [options] - Additional options for the creation process.
   * @returns {Promise<BaseModel>} - A promise that resolves to the created model instance.
   * @throws {ValidationError} - Throws if validation fails.
   */
  async create(item, options = {}) {
    this.#validateImsOrgId(item?.imsOrgId);
    this.#validateCapabilities(item?.capabilities);
    await this.#validateClientIdUniqueness(item?.clientId);
    return super.create(item, options);
  }
}

export default ConsumerCollection;
