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

class PostgresImportJobModel extends PostgresBaseModel {
  static ENTITY_NAME = 'ImportJob';

  static ImportJobStatus = {
    RUNNING: 'RUNNING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    STOPPED: 'STOPPED',
  };

  static ImportUrlStatus = {
    PENDING: 'PENDING',
    REDIRECT: 'REDIRECT',
    ...PostgresImportJobModel.ImportJobStatus,
  };

  static ImportOptions = {
    ENABLE_JAVASCRIPT: 'enableJavascript',
    PAGE_LOAD_TIMEOUT: 'pageLoadTimeout',
    TYPE: 'type',
    DATA: 'data',
  };

  static ImportOptionTypes = {
    DOC: 'doc',
    XWALK: 'xwalk',
    DA: 'da',
  };
}

export default PostgresImportJobModel;
