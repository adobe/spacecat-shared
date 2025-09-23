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
 * FixEntitySuggestion - A junction table class representing the many-to-many relationship
 * between FixEntity and Suggestion entities. This allows one fix entity to be associated
 * with multiple suggestions and one suggestion to be associated with multiple fix entities.
 *
 * @class FixEntitySuggestion
 * @extends BaseModel
 */
class FixEntitySuggestion extends BaseModel {
  static DEFAULT_UPDATED_BY = 'spacecat';

  // Add custom methods here for junction-specific functionality
}

export default FixEntitySuggestion;
