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
import { DATA_SCHEMAS } from '../../suggestion/suggestion.data-schemas.js';
import { FIELD_TRANSFORMERS, FALLBACK_PROJECTION } from '../../suggestion/suggestion.projection-utils.js';

class PostgresSuggestionModel extends PostgresBaseModel {
  static ENTITY_NAME = 'Suggestion';

  static STATUSES = {
    NEW: 'NEW',
    APPROVED: 'APPROVED',
    IN_PROGRESS: 'IN_PROGRESS',
    SKIPPED: 'SKIPPED',
    FIXED: 'FIXED',
    ERROR: 'ERROR',
    OUTDATED: 'OUTDATED',
    PENDING_VALIDATION: 'PENDING_VALIDATION',
    REJECTED: 'REJECTED',
  };

  static TYPES = {
    CODE_CHANGE: 'CODE_CHANGE',
    CONTENT_UPDATE: 'CONTENT_UPDATE',
    REDIRECT_UPDATE: 'REDIRECT_UPDATE',
    METADATA_UPDATE: 'METADATA_UPDATE',
    AI_INSIGHTS: 'AI_INSIGHTS',
    CONFIG_UPDATE: 'CONFIG_UPDATE',
  };

  static FIELD_TRANSFORMERS = FIELD_TRANSFORMERS;

  static DATA_SCHEMAS = DATA_SCHEMAS;

  static FALLBACK_PROJECTION = FALLBACK_PROJECTION;

  static getProjection(opportunityType, viewName = 'minimal') {
    const schemaConfig = this.DATA_SCHEMAS[opportunityType];

    if (schemaConfig?.projections?.[viewName]) {
      return schemaConfig.projections[viewName];
    }

    return this.FALLBACK_PROJECTION[viewName] || this.FALLBACK_PROJECTION.minimal;
  }

  static validateData(data, opportunityType) {
    const schemaConfig = this.DATA_SCHEMAS[opportunityType];

    if (!schemaConfig?.schema) {
      return;
    }

    const { error } = schemaConfig.schema.validate(data);
    if (error) {
      throw new Error(`Invalid data for opportunity type ${opportunityType}: ${error.message}`);
    }
  }
}

export default PostgresSuggestionModel;
