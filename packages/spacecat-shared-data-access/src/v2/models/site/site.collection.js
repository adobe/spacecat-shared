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

import { hasText, isValidUrl } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import Site from '../organization/organization.model.js';

/**
 * SiteCollection - A collection class responsible for managing Site entities.
 * Extends the BaseCollection to provide specific methods for interacting with Site records.
 *
 * @class SiteCollection
 * @extends BaseCollection
 */
class SiteCollection extends BaseCollection {
  /**
   * Constructs an instance of SiteCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage Site entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, Site, log);
  }

  async allByBaseURL(baseURL) {
    if (!isValidUrl(baseURL)) {
      throw new Error('Base URL must be a valid URL');
    }
    return this.findByIndexKeys({ baseURL });
  }

  async allByDeliveryType(deliveryType) {
    if (!hasText(deliveryType)) {
      throw new Error('Delivery Type is required');
    }
    return this.findByIndexKeys({ deliveryType });
  }

  async allByOrganizationId(organizationId) {
    if (!hasText(organizationId)) {
      throw new Error('Organization ID is required');
    }
    return this.findByIndexKeys({ organizationId });
  }
}

export default SiteCollection;
