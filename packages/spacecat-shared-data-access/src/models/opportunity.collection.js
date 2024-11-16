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

class OpportunityCollection extends BaseCollection {
  constructor(service, modelFactory, log) {
    super(service, modelFactory, Opportunity, log);
  }

  async allBySiteId(siteId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const records = await this.entity.query.bySiteId({ siteId }).go();

    return this._createInstances(records);
  }
}

export default OpportunityCollection;
