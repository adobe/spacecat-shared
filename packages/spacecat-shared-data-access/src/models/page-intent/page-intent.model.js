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
 * PageIntent - Represents a page’s intent & topic within a site.
 *
 * @class PageIntent
 * @extends BaseModel
 */
class PageIntent extends BaseModel {
  static DEFAULT_UPDATED_BY = 'spacecat';

  static PAGE_INTENTS = {
    INFORMATIONAL: 'INFORMATIONAL',
    NAVIGATIONAL: 'NAVIGATIONAL',
    TRANSACTIONAL: 'TRANSACTIONAL',
    COMMERCIAL: 'COMMERCIAL',
  };

  // add any custom methods or overrides here
}

export default PageIntent;
