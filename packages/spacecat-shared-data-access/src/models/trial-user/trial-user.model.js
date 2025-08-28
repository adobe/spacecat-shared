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
 * TrialUser - A class representing a trial user entity.
 * Provides methods to access and manipulate trial user-specific data.
 *
 * @class TrialUser
 * @extends BaseModel
 */
class TrialUser extends BaseModel {
  /**
   * Trial user status types.
   * Any change to this object needs to be reflected in the index.d.ts file as well.
   */
  static STATUSES = {
    INVITED: 'INVITED',
    REGISTERED: 'REGISTERED', // User has logged in at least once
    BLOCKED: 'BLOCKED',
    DELETED: 'DELETED',
  };
}

export default TrialUser;
