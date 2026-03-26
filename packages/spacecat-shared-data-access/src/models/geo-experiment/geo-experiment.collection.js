/*
 * Copyright 2026 Adobe. All rights reserved.
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

class GeoExperimentCollection extends BaseCollection {
  static COLLECTION_NAME = 'GeoExperimentCollection';

  /**
   * Finds a GeoExperiment by its caller-supplied text ID.
   * Overrides BaseCollection.findById to bypass UUID-only guardId validation,
   * since geoExperimentId is a human-readable text key (not a UUID).
   * @param {string} id - The experiment ID (e.g. "exp-adobe.com-llmo-1234567890")
   * @returns {Promise<GeoExperiment|null>}
   */
  async findById(id) {
    if (!hasText(id)) {
      throw new ValidationError(`Validation failed in ${this.entityName}: geoExperimentId must be a non-empty string`);
    }
    return this.findByIndexKeys({ [this.idName]: id });
  }
}

export default GeoExperimentCollection;
