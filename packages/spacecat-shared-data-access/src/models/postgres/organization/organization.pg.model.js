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

import { Config } from '../../site/config.js';
import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresOrganizationModel extends PostgresBaseModel {
  static ENTITY_NAME = 'Organization';

  static IMS_ORG_ID_REGEX = /[a-z0-9]{24}@AdobeOrg/i;

  /**
   * Returns the config wrapped in a Config helper. The base collection's
   * #createInstance already applies the schema 'get' transformer, so
   * this.record.config may already be a Config object. If it's still raw
   * JSON (e.g. right after setConfig), wrap it on the fly.
   * @returns {Config}
   */
  getConfig() {
    const raw = this.record.config;
    if (raw && typeof raw.getSlackConfig === 'function') {
      return raw; // already a Config object
    }
    return Config(raw || {});
  }

  /**
   * Sets config from raw JSON. The raw value is stored via the patcher
   * so persistence works correctly.
   * @param {object} value - raw config JSON or Config object
   * @returns {PostgresOrganizationModel}
   */
  setConfig(value) {
    // If a Config object was passed, extract the raw state
    const raw = value && typeof value.getSlackConfig === 'function'
      ? { ...value.state }
      : value;
    this.patcher.patchValue('config', raw);
    return this;
  }
}

export default PostgresOrganizationModel;
