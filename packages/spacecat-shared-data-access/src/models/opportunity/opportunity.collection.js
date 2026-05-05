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
 * OpportunityCollection - A collection class responsible for managing Opportunity entities.
 * Extends the BaseCollection to provide specific methods for interacting with Opportunity records.
 *
 * @class OpportunityCollection
 * @extends BaseCollection
 */
class OpportunityCollection extends BaseCollection {
  static COLLECTION_NAME = 'OpportunityCollection';

  /**
   * Returns all opportunities matching a given scope type and scope ID.
   *
   * @param {string} scopeType - The scope type (e.g. 'brand').
   * @param {string} scopeId - The scope entity UUID.
   * @returns {Promise<Opportunity[]>} The matching opportunities.
   */
  async allByScope(scopeType, scopeId) {
    if (!hasText(scopeType)) {
      throw new Error('allByScope: scopeType is required');
    }
    if (!hasText(scopeId)) {
      throw new Error('allByScope: scopeId is required');
    }
    return this.allByIndexKeys({ scopeType, scopeId });
  }
}

export default OpportunityCollection;
