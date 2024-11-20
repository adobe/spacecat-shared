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

import BaseCollection from './base.collection.js';
import Opportunity from './opportunity.model.js';

/**
 * OpportunityCollection - A collection class responsible for managing Opportunity entities.
 * Extends the BaseCollection to provide specific methods for interacting with Opportunity records.
 *
 * @class OpportunityCollection
 * @extends BaseCollection
 */
class OpportunityCollection extends BaseCollection {
  /**
   * Constructs an instance of OpportunityCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage Opportunity entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, Opportunity, log);
  }

  /**
   * Retrieves all Opportunity entities by their associated site ID.
   * @async
   * @param {string} siteId - The unique identifier of the site.
   * @returns {Promise<Array<Opportunity>>} - A promise that resolves to an array of
   * Opportunity instances related to the given site ID.
   * @throws {Error} - Throws an error if the siteId is not provided or if the query fails.
   */
  async allBySiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const records = await this.entity.query.bySiteId({ siteId }).go();

    return this._createInstances(records);
  }

  /**
   * Retrieves all Opportunity entities by their associated site ID and status.
   * @param {string} siteId - The unique identifier of the site.
   * @param {string} status - The status of the Opportunity entities to retrieve.
   * @return {Promise<Array<BaseModel>>} - A promise that resolves to an array of
   * Opportunity instances.
   * @throws {Error} - Throws an error if the siteId or status is not provided or if the
   * query fails.
   */
  async allBySiteIdAndStatus(siteId, status) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!hasText(status)) {
      throw new Error('Status is required');
    }

    const records = await this.entity.query.bySiteIdAndStatus({ siteId, status }).go();
    return this._createInstances(records);
  }
}

export default OpportunityCollection;
