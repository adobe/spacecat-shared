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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import BaseModel from '../base/base.model.js';

/**
 * Consumer - A class representing a Consumer entity.
 * Provides methods to access and manipulate Consumer-specific data.
 *
 * @class Consumer
 * @extends BaseModel
 */
class Consumer extends BaseModel {
  static ENTITY_NAME = 'Consumer';

  static STATUS = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    REVOKED: 'REVOKED',
  };

  /**
   * Checks whether this consumer has been revoked.
   * @returns {boolean} - True if the consumer has been revoked.
   */
  isRevoked() {
    return this.getStatus() === Consumer.STATUS.REVOKED
      || (isIsoDate(this.getRevokedAt()) && new Date(this.getRevokedAt()) <= new Date());
  }

  /**
   * Saves the consumer after validating capabilities against the allowlist.
   * Prevents capability escalation via setCapabilities() + save().
   * @async
   * @returns {Promise<Consumer>} - The saved consumer instance.
   * @throws {ValidationError} - If capabilities are invalid.
   */
  async save() {
    this.collection.validateCapabilities(this.getCapabilities());
    return super.save();
  }

  static CAPABILITIES = ['read', 'write', 'delete'];

  static IMS_ORG_ID_REGEX = /^[a-z0-9]{24}@AdobeOrg$/i;

  static TECHNICAL_ACCOUNT_ID_REGEX = /^[a-z0-9]{24}@techacct\.adobe\.com$/i;
}

export default Consumer;
