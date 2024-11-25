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

import BaseModel from './base.model.js';

/**
 * Suggestion - A class representing a Suggestion entity.
 * Provides methods to access and manipulate Suggestion-specific data,
 * such as related opportunities, types, statuses, etc.
 *
 * @class Suggestion
 * @extends BaseModel
 */
class Suggestion extends BaseModel {
  /**
   * Gets the Opportunity ID for this Suggestion.
   * @returns {string} - The unique identifier of the related Opportunity.
   */
  getOpportunityId() {
    return this.record.opportunityId;
  }

  /**
   * Sets the Opportunity ID for this Suggestion.
   * @param {string} opportunityId - The unique identifier of the related Opportunity.
   * @returns {Suggestion} - The current instance of Suggestion for chaining.
   * @throws {Error} - Throws an error if the opportunityId is not a valid UUID.
   */
  setOpportunityId(opportunityId) {
    this.patcher.patchValue('opportunityId', opportunityId, true);
    return this;
  }

  /**
   * Gets the type of this Suggestion.
   * @returns {string} - The type of the Suggestion (e.g., CODE_CHANGE, CONTENT_UPDATE).
   */
  getType() {
    return this.record.type;
  }

  /**
   * Gets the status of this Suggestion.
   * @returns {string} - The status of the Suggestion (e.g., NEW, APPROVED, SKIPPED, FIXED, ERROR).
   */
  getStatus() {
    return this.record.status;
  }

  /**
   * Sets the status of this Suggestion. Check the schema for possible values.
   * @param {string} status - The new status of the Suggestion.
   * @returns {Suggestion} - The current instance of Suggestion for chaining.
   * @throws {Error} - Throws an error if the status is not a valid value.
   */
  setStatus(status) {
    this.patcher.patchValue('status', status);
    return this;
  }

  /**
   * Gets the rank of this Suggestion.
   * @returns {number} - The rank of the Suggestion used for sorting or prioritization.
   */
  getRank() {
    return this.record.rank;
  }

  /**
   * Sets the rank of this Suggestion.
   * @param {number} rank - The rank value to set for this Suggestion.
   * @returns {Suggestion} - The current instance of Suggestion for chaining.
   * @throws {Error} - Throws an error if the rank is not a valid number.
   */
  setRank(rank) {
    this.patcher.patchValue('rank', rank);
    return this;
  }

  /**
   * Gets additional data associated with this Suggestion.
   * @returns {Object} - The additional data for the Suggestion.
   */
  getData() {
    return this.record.data;
  }

  /**
   * Sets additional data for this Suggestion.
   * @param {Object} data - The data to set for the Suggestion.
   * @returns {Suggestion} - The current instance of Suggestion for chaining.
   * @throws {Error} - Throws an error if the data is not a valid object.
   */
  setData(data) {
    this.patcher.patchValue('data', data);
    return this;
  }

  /**
   * Gets the KPI deltas for this Suggestion.
   * @returns {Object} - The key performance indicator deltas that are affected by this Suggestion.
   */
  getKpiDeltas() {
    return this.record.kpiDeltas;
  }

  /**
   * Sets the KPI deltas for this Suggestion.
   * @param {Object} kpiDeltas - The KPI deltas to set for the Suggestion.
   * @returns {Suggestion} - The current instance of Suggestion for chaining.
   * @throws {Error} - Throws an error if the kpiDeltas is not a valid object.
   */
  setKpiDeltas(kpiDeltas) {
    this.patcher.patchValue('kpiDeltas', kpiDeltas);
    return this;
  }
}

export default Suggestion;
