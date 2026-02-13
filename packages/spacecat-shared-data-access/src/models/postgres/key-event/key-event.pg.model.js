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

import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresKeyEventModel extends PostgresBaseModel {
  static ENTITY_NAME = 'KeyEvent';

  static KEY_EVENT_TYPES = {
    PERFORMANCE: 'PERFORMANCE',
    SEO: 'SEO',
    CONTENT: 'CONTENT',
    CODE: 'CODE',
    THIRD_PARTY: 'THIRD PARTY',
    EXPERIMENTATION: 'EXPERIMENTATION',
    NETWORK: 'NETWORK',
    STATUS_CHANGE: 'STATUS CHANGE',
  };
}

export default PostgresKeyEventModel;
