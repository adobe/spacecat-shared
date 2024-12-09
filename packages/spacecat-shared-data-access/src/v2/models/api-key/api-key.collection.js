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

import BaseCollection from '../base/base.collection.js';
import ApiKey from './api-key.model.js';

/**
 * ApiKeyCollection - A collection class responsible for managing ApiKey entities.
 * Extends the BaseCollection to provide specific methods for interacting with ApiKey records.
 *
 * @class ApiKeyCollection
 * @extends BaseCollection
 */
class ApiKeyCollection extends BaseCollection {
  /**
   * Constructs an instance of ApiKeyCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage ApiKey entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, ApiKey, log);
  }

  // add custom methods here

  allByImsUserIdAndImsOrgId(imsUserId, imsOrgId) {
    if (!imsUserId) {
      throw new Error('ImsUserId is required');
    }

    if (!imsOrgId) {
      throw new Error('ImsOrgId is required');
    }

    return this.allByIndexKeys({}, { imsUserId, imsOrgId }, { index: 'byHashedApiKey' });
  }

  async findByHashedApiKey(hashedApiKey) {
    if (!hashedApiKey) {
      throw new Error('HashedApiKey is required');
    }

    return this.findByIndexKeys({ hashedApiKey });
  }
}

export default ApiKeyCollection;
