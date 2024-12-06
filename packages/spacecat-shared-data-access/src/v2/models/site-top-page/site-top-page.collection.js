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
import SiteTopPage from './site-top-page.model.js';

/**
 * SiteTopPageCollection - A collection class responsible for managing SiteTopPage entities.
 * Extends the BaseCollection to provide specific methods for interacting with SiteTopPage records.
 *
 * @class SiteTopPageCollection
 * @extends BaseCollection
 */
class SiteTopPageCollection extends BaseCollection {
  /**
   * Constructs an instance of SiteTopPageCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage SiteTopPage entities.
   * @param {Object} modelFactory - A factory for creating model instances.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, modelFactory, log) {
    super(service, modelFactory, SiteTopPage, log);
  }

  async allBySiteIdAndSourceAndGeo(siteId, source, geo) {
    if (!hasText(siteId)) {
      throw new ValidationError('SiteId is required');
    }

    if (!hasText(source)) {
      throw new ValidationError('Source is required');
    }

    if (!hasText(geo)) {
      throw new ValidationError('Geo is required');
    }

    return this.allByIndexKeys({ siteId, source, geo }, { index: 'bySiteId' });
  }

  async removeForSiteId(siteId, source, geo) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    let topPagesToRemove;

    if (hasText(source) && hasText(geo)) {
      topPagesToRemove = await this.allByIndexKeys({ siteId, source, geo });
    } else {
      topPagesToRemove = await this.allByIndexKeys({ siteId });
    }

    const topPageIdsToRemove = topPagesToRemove.map((topPage) => topPage.getId());

    await this.removeByIds(topPageIdsToRemove);
  }
}

export default SiteTopPageCollection;
