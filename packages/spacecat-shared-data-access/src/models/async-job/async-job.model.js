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
 * AsyncJob - A class representing an AsyncJob entity.
 * Provides methods to access and manipulate AsyncJob-specific data.
 *
 * @class AsyncJob
 * @extends BaseModel
 */
class AsyncJob extends BaseModel {
  static ENTITY_NAME = 'AsyncJob';

  /**
   * Async Job Status types.
   * Any changes to this object needs to be reflected in the index.d.ts file as well.
   */
  static Status = {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  };

  /**
   * Async Job Result types.
   */
  static ResultType = {
    S3: 'S3',
    INLINE: 'INLINE',
    URL: 'URL',
  };

  // Add custom methods or overrides here if needed
}

export default AsyncJob;
