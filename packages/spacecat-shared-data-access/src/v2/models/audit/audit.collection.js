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
import Audit from './audit.model.js';

/**
 * AuditCollection - A collection class responsible for managing Audit entities.
 * Extends the BaseCollection to provide specific methods for interacting with Audit records.
 *
 * @class AuditCollection
 * @extends BaseCollection
 */
class AuditCollection extends BaseCollection {
  /**
   * Constructs an instance of AuditCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage Audit entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, Audit, log);
  }

  /**
   * Retrieves all organizations associated with the specified site.
   *
   * @param {string} siteId - The site ID.
   * @return {Promise<Audit[]>} - A promise that resolves to an array of Audit instances.
   */
  async allBySiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('Site ID is required');
    }
    return this.allByIndexKeys({ siteId });
  }

  async allBySiteAndType(siteId, auditType) {
    if (!hasText(siteId)) {
      throw new Error('Site ID is required');
    }
    if (!hasText(auditType)) {
      throw new Error('Audit type is required');
    }
    return this.allByIndexKeys({ siteId, auditType });
  }
}

export default AuditCollection;
