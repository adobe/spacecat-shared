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
 * Consumer - A class representing a Consumer entity.
 * Provides methods to access and manipulate Consumer-specific data.
 *
 * @class Consumer
 * @extends BaseModel
 */
class Consumer extends BaseModel {
  static ENTITY_NAME = 'Consumer';

  static STATUS = {
    ACTIVE: 'ACTIVE',
    SUSPEND: 'SUSPEND',
  };

  static ISSUER_ID_REGEX = /[a-z0-9]{24}@AdobeOrg/i;

  static ALLOWED_ISSUER_IDS = {
    PRODUCTION: '908936ED5D35CC220A495CD4@AdobeOrg',
    STAGE: '8C6043F15F43B6390A49401A@AdobeOrg',
  };
}

export default Consumer;
