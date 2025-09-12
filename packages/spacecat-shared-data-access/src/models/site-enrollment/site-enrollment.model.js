/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import BaseModel from '../base/base.model.js';

/**
 * SiteEnrollment - A class representing a SiteEnrollment entity.
 * Provides methods to access and manipulate SiteEnrollment-specific data.
 *
 * @class SiteEnrollment
 * @extends BaseModel
 */
class SiteEnrollment extends BaseModel {
  /**
   * Gets the configuration map for this site enrollment.
   * @returns {Record<string, string>} The configuration key-value pairs.
   */
  getConfig() {
    return this.record.config || {};
  }

  /**
   * Sets the configuration map for this site enrollment.
   * @param {Record<string, string>} config - The configuration key-value pairs.
   * @returns {SiteEnrollment} This instance for method chaining.
   */
  setConfig(config) {
    this.record.config = config || {};
    return this;
  }
}

export default SiteEnrollment;
