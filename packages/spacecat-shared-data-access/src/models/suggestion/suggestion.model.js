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
import { DATA_SCHEMAS } from './suggestion.data-schemas.js';
import { FIELD_TRANSFORMERS, FALLBACK_PROJECTION } from './suggestion.projection-utils.js';

/**
 * Suggestion - A class representing a Suggestion entity.
 * Provides methods to access and manipulate Suggestion-specific data,
 * such as related opportunities, types, statuses, etc.
 *
 * @class Suggestion
 * @extends BaseModel
 */
class Suggestion extends BaseModel {
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

  /** Predefined categories for skip reason. Maps to PostgreSQL skip_reason. */
  static SKIP_REASONS = {
    ALREADY_IMPLEMENTED: 'already_implemented',
    INACCURATE_OR_INCOMPLETE: 'inaccurate_or_incomplete',
    TOO_RISKY: 'too_risky',
    NO_REASON: 'no_reason',
    OTHER: 'other',
  };

  // Import schemas from external file for maintainability
  static FIELD_TRANSFORMERS = FIELD_TRANSFORMERS;

  static DATA_SCHEMAS = DATA_SCHEMAS;

  static FALLBACK_PROJECTION = FALLBACK_PROJECTION;

  /**
   * Gets the projection configuration for a given opportunity type and view.
   * Falls back to FALLBACK_PROJECTION if no schema is defined for the type.
   *
   * @param {string} opportunityType - The opportunity type from OPPORTUNITY_TYPES enum
   * @param {string} [viewName='minimal'] - The view name (e.g., 'minimal', 'summary')
   * @returns {Object} Projection configuration with fields and transformers
   *
   * @example
   * const projection = Suggestion.getProjection('cwv', 'minimal');
   * // Returns: { fields: ['url', 'type', 'metrics', 'issues'],
   * //   transformers: { metrics: 'filterCwvMetrics' } }
   */
  static getProjection(opportunityType, viewName = 'minimal') {
    const schemaConfig = this.DATA_SCHEMAS[opportunityType];

    if (schemaConfig?.projections?.[viewName]) {
      return schemaConfig.projections[viewName];
    }

    // Fallback for unknown types
    return this.FALLBACK_PROJECTION[viewName] || this.FALLBACK_PROJECTION.minimal;
  }

  /**
   * Validates suggestion data against the Joi schema for the given opportunity type.
   * If no schema is defined, validation is skipped (graceful fallback).
   *
   * **Usage:** Call this in audit-worker before creating/updating suggestions to ensure
   * data structure consistency across services.
   *
   * @param {Object} data - Suggestion data to validate
   * @param {string} opportunityType - The opportunity type from OPPORTUNITY_TYPES enum
   * @throws {Error} If validation fails with details
   *
   * @example
   * // In audit-worker before creating a suggestion:
   * try {
   *   Suggestion.validateData({ url: 'https://example.com' }, 'structured-data');
   *   // Proceed with creating suggestion
   * } catch (error) {
   *   log.error('Invalid suggestion data:', error.message);
   * }
   */
  static validateData(data, opportunityType) {
    const schemaConfig = this.DATA_SCHEMAS[opportunityType];

    if (!schemaConfig?.schema) {
      // No schema defined, skip validation
      return;
    }

    const { error } = schemaConfig.schema.validate(data);
    if (error) {
      throw new Error(`Invalid data for opportunity type ${opportunityType}: ${error.message}`);
    }
  }

  // add your customized method here
}

export default Suggestion;
