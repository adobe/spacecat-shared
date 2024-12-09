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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import { ValidationError } from '../../errors/index.js';
import ImportJob from './import-job.model.js';

/**
 * ImportJobCollection - A collection class responsible for managing ImportJob entities.
 * Extends the BaseCollection to provide specific methods for interacting with ImportJob records.
 *
 * @class ImportJobCollection
 * @extends BaseCollection
 */
class ImportJobCollection extends BaseCollection {
  /**
   * Constructs an instance of ImportJobCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage ImportJob entities.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection..
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, entityRegistry, log) {
    super(service, entityRegistry, ImportJob, log);
  }

  // add custom methods here

  async allByDateRange(startDate, endDate) {
    if (!isIsoDate(startDate)) {
      throw new ValidationError(`Invalid start date: ${startDate}`);
    }

    if (!isIsoDate(endDate)) {
      throw new ValidationError(`Invalid end date: ${endDate}`);
    }

    return this.allByIndexKeys({ pk: 'all_importjobs' }, {}, {
      index: 'all',
      between: {
        attribute: 'startedAt',
        start: startDate,
        end: endDate,
      },
    });
  }
}

export default ImportJobCollection;
