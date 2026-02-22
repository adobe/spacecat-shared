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

import BaseCollection from '../base/base.collection.js';

/**
 * EntitlementCollection - A collection class responsible for managing Entitlement entities.
 * Extends the BaseCollection to provide specific methods for interacting with Entitlement records.
 *
 * @class EntitlementCollection
 * @extends BaseCollection
 */
class EntitlementCollection extends BaseCollection {
  static COLLECTION_NAME = 'EntitlementCollection';

  /** Organization ID treated as freemium for token/plan logic. */
  static FREEMIUM_ORGANIZATION_ID = 'ed79490b-4248-4b86-9536-b35e122772f4';

  /**
   * Returns whether the organization is on the freemium plan.
   *
   * @param {string} organizationId - Organization ID (UUID).
   * @returns {boolean} True if the organization is the designated freemium org, false otherwise.
   */
  isFreemium(organizationId) {
    return this.constructor.isFreemium(organizationId);
  }

  /**
   * Returns whether the organization is on the freemium plan (static implementation).
   *
   * @param {string} organizationId - Organization ID (UUID).
   * @returns {boolean} True if the organization is the designated freemium org, false otherwise.
   */
  static isFreemium(organizationId) {
    if (!hasText(organizationId)) {
      throw new Error('organizationId is required');
    }
    return organizationId === EntitlementCollection.FREEMIUM_ORGANIZATION_ID;
  }
}

export default EntitlementCollection;
