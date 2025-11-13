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
 * FixEntity - A class representing a FixEntity for a Suggestion.
 * Provides methods to access and manipulate FixEntity-specific data.
 *
 * @class FixEntity
 * @extends BaseModel
 */
class FixEntity extends BaseModel {
  static DEFAULT_UPDATED_BY = 'spacecat';

  static STATUSES = {
    PENDING: 'PENDING', // the fix is pending to be deployed
    DEPLOYED: 'DEPLOYED', // the fix was successfully applied
    PUBLISHED: 'PUBLISHED', // the fix is live in production
    FAILED: 'FAILED', // failed to apply the fix
    ROLLED_BACK: 'ROLLED_BACK', // the fix has been rolled_back
  };

  static ORIGINS = {
    SPACECAT: 'spacecat',
    ASO: 'aso',
    REPORTING: 'reporting',
  };

  async getSuggestions() {
    const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');
    return fixEntityCollection
      .getSuggestionsByFixEntityId(this.getId());
  }
}

export default FixEntity;
