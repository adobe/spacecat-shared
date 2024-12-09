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

import { ValidationError } from '../../errors/index.js';
import BaseCollection from '../base/base.collection.js';
import Opportunity, { STATUSES } from './opportunity.model.js';

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
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection..
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, entityRegistry, log) {
    super(service, entityRegistry, Opportunity, log);
  }

  async allBySiteIdAndStatus(siteId, status) {
    if (!hasText(siteId)) {
      throw new ValidationError('Site ID required');
    }

    if (!Object.values(STATUSES).includes(status)) {
      throw new ValidationError('Invalid status');
    }

    return this.allByIndexKeys({ siteId }, { status });
  }

  // add custom methods here
}

export default OpportunityCollection;
