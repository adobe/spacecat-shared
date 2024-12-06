/*
 * Copyright 2024 Adobe. All rights reserved.
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

export const STATUSES = {
  NEW: 'NEW',
  APPROVED: 'APPROVED',
  SKIPPED: 'SKIPPED',
  FIXED: 'FIXED',
  ERROR: 'ERROR',
};

export const TYPES = {
  CODE_CHANGE: 'CODE_CHANGE',
  CONTENT_UPDATE: 'CONTENT_UPDATE',
  REDIRECT_UPDATE: 'REDIRECT_UPDATE',
  METADATA_UPDATE: 'METADATA_UPDATE',
};

/**
 * Suggestion - A class representing a Suggestion entity.
 * Provides methods to access and manipulate Suggestion-specific data,
 * such as related opportunities, types, statuses, etc.
 *
 * @class Suggestion
 * @extends BaseModel
 */
class Suggestion extends BaseModel {
  // add your customized methods here
}

export default Suggestion;
