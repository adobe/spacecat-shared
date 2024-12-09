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
import Experiment from './experiment.model.js';

/**
 * ExperimentCollection - A collection class responsible for managing Experiment entities.
 * Extends the BaseCollection to provide specific methods for interacting with Experiment records.
 *
 * @class ExperimentCollection
 * @extends BaseCollection
 */
class ExperimentCollection extends BaseCollection {
  /**
   * Constructs an instance of ExperimentCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage Experiment entities.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection..
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, entityRegistry, log) {
    super(service, entityRegistry, Experiment, log);
  }

  async allBySiteIdAndExpId(siteId, expId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!hasText(expId)) {
      throw new Error('ExpId is required');
    }

    return this.allByIndexKeys({ siteId, expId });
  }

  async findBySiteIdAndExpId(siteId, expId) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!hasText(expId)) {
      throw new Error('ExpId is required');
    }

    return this.findByIndexKeys({ siteId, expId });
  }

  async findBySiteIdAndExpIdAndUrl(siteId, expId, url) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    if (!hasText(expId)) {
      throw new Error('ExpId is required');
    }

    if (!isValidUrl(url)) {
      throw new Error('Url must be a valid URL');
    }

    return this.findByIndexKeys({ siteId, expId, url });
  }
}

export default ExperimentCollection;