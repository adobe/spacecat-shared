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

import { guardId } from '../../util/guards.js';
import BaseCollection from '../base/base.collection.js';

/**
 * OaeValidationCollection - A collection class responsible for managing OaeValidation records.
 *
 * @class OaeValidationCollection
 * @extends BaseCollection
 */
class OaeValidationCollection extends BaseCollection {
  static COLLECTION_NAME = 'OaeValidationCollection';

  /**
   * Gets all rows for a given job.
   *
   * @async
   * @param {string} jobId - The job ID grouping the suggestions submitted together.
   * @param {Object} options - Additional query options.
   * @returns {Promise<Array>} - A promise that resolves to an array of OaeValidation records.
   * @throws {Error} - Throws an error if the jobId is not provided.
   */
  async allByJobId(jobId, options = {}) {
    guardId('jobId', jobId, 'OaeValidationCollection');
    return this.allByIndexKeys({ jobId }, options);
  }
}

export default OaeValidationCollection;
