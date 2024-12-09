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
import ImportUrl from './import-url.model.js';
import { ValidationError } from '../../errors/index.js';
import { ImportUrlStatus } from '../import-job/import-job.model.js';

/**
 * ImportUrlCollection - A collection class responsible for managing ImportUrl entities.
 * Extends the BaseCollection to provide specific methods for interacting with ImportUrl records.
 *
 * @class ImportUrlCollection
 * @extends BaseCollection
 */
class ImportUrlCollection extends BaseCollection {
  /**
   * Constructs an instance of ImportUrlCollection. Tells the base class which model to use.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage ImportUrl entities.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection..
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(service, entityRegistry, log) {
    super(service, entityRegistry, ImportUrl, log);
  }

  // add custom methods here

  async allByImportJobIdAndStatus(importJobId, status) {
    if (!hasText(importJobId)) {
      throw new ValidationError('Invalid importJobId');
    }

    if (!Object.values(ImportUrlStatus).includes(status)) {
      throw new ValidationError('Invalid status');
    }

    return this.allByIndexKeys({ importJobId }, { status });
  }
}

export default ImportUrlCollection;
