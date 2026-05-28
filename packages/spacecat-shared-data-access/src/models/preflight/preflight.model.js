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
 * Preflight - A class representing a Preflight entity.
 * Provides methods to access and manipulate Preflight-specific data.
 *
 * @class Preflight
 * @extends BaseModel
 */
class Preflight extends BaseModel {
  static ENTITY_NAME = 'Preflight';

  static Status = {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  };

  toJSON() {
    const json = super.toJSON();
    // asyncJobId is an internal FK reference — never exposed to API consumers
    delete json.asyncJobId;
    return json;
  }
}

export default Preflight;
