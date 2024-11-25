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
 * Opportunity - A class representing an Opportunity entity.
 * Provides methods to access and manipulate Opportunity-specific data,
 * such as related suggestions, audit IDs, site IDs, etc.
 *
 * @class Opportunity
 * @extends BaseModel
 */

class Opportunity extends BaseModel {
  /**
   * Adds the given suggestions to this Opportunity. Sets this opportunity as the parent
   * of each suggestion, as such the opportunity ID does not need to be provided.
   *
   * @async
   * @param {Array<Object>} suggestions - An array of suggestion objects to add.
   * @return {Promise<{ createdItems: BaseModel[],
   * errorItems: { item: Object, error: ValidationError }[] }>} - A promise that
   * resolves to an object containing the created suggestion items and any
   * errors that occurred.
   */
  async addSuggestions(suggestions) {
    const childSuggestions = suggestions.map((suggestion) => ({
      ...suggestion,
      [this.idName]: this.getId(),
    }));
    return this.modelFactory
      .getCollection('SuggestionCollection')
      .createMany(childSuggestions, this);
  }

  /**
   * Gets the ID of the site associated with this Opportunity.
   * @returns {string} - The unique identifier of the site.
   */
  getSiteId() {
    return this.record.siteId;
  }

  /**
   * Sets the site ID for this Opportunity (associates it with a site).
   * @param {string} siteId - The unique identifier of the site.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the siteId is not a valid UUID.
   */
  setSiteId(siteId) {
    this.patcher.patchValue('siteId', siteId, true);
    return this;
  }

  /**
   * Gets the ID of the audit associated with this Opportunity.
   * @returns {string} - The unique identifier of the audit.
   */
  getAuditId() {
    return this.record.auditId;
  }

  /**
   * Sets the audit ID for this Opportunity (associates it with an audit).
   * @param {string} auditId - The unique identifier of the audit.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the auditId is not a valid UUID.
   */
  setAuditId(auditId) {
    this.patcher.patchValue('auditId', auditId, true);
    return this;
  }

  /**
   * Gets the runbook URL or reference for this Opportunity.
   * @returns {string} - The runbook reference for this Opportunity.
   */
  getRunbook() {
    return this.record.runbook;
  }

  /**
   * Sets the runbook URL or reference for this Opportunity.
   * @param {string} runbook - The runbook reference or URL.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the runbook is not a string or empty.
   */
  setRunbook(runbook) {
    this.patcher.patchValue('runbook', runbook);
    return this;
  }

  /**
   * Gets the guidance information for this Opportunity.
   * @returns {Object} - The guidance object for this Opportunity.
   */
  getGuidance() {
    return this.record.guidance;
  }

  /**
   * Sets the guidance information for this Opportunity.
   * @param {Object} guidance - The guidance object.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the guidance is not an object or empty.
   */
  setGuidance(guidance) {
    this.patcher.patchValue('guidance', guidance);
    return this;
  }

  /**
   * Gets the title of this Opportunity.
   * @returns {string} - The title of the Opportunity.
   */
  getTitle() {
    return this.record.title;
  }

  /**
   * Sets the title of this Opportunity.
   * @param {string} title - The title of the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the title is not a string or empty.
   */
  setTitle(title) {
    this.patcher.patchValue('title', title);
    return this;
  }

  /**
   * Gets the description of this Opportunity.
   * @returns {string} - The description of the Opportunity.
   */
  getDescription() {
    return this.record.description;
  }

  /**
   * Sets the description of this Opportunity.
   * @param {string} description - The description of the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the description is not a string or empty.
   */
  setDescription(description) {
    this.patcher.patchValue('description', description);
    return this;
  }

  /**
   * Gets the type of this Opportunity.
   * @returns {string} - The type of the Opportunity.
   */
  getType() {
    return this.record.type;
  }

  /**
   * Gets the status of this Opportunity.
   * @returns {string} - The status of the Opportunity.
   */
  getStatus() {
    return this.record.status;
  }

  /**
   * Sets the status of this Opportunity. Check the schema for valid status values.
   * @param {string} status - The status of the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the status is not a valid value.
   */
  setStatus(status) {
    this.patcher.patchValue('status', status);
    return this;
  }

  /**
   * Gets the origin of this Opportunity.
   * @returns {string} - The origin of the Opportunity (e.g., ESS_OPS, AI, AUTOMATION).
   */
  getOrigin() {
    return this.record.origin;
  }

  /**
   * Sets the origin of this Opportunity. Check the schema for valid origin values.
   * @param {string} origin - The origin of the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the origin is not a valid value.
   */
  setOrigin(origin) {
    this.patcher.patchValue('origin', origin);
    return this;
  }

  /**
   * Gets the tags associated with this Opportunity.
   * @returns {Array<string>} - An array of tags associated with the Opportunity.
   */
  getTags() {
    return this.record.tags;
  }

  /**
   * Sets the tags for this Opportunity. Duplicate tags are made unique.
   * @param {Array<string>} tags - An array of tags to associate with the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the tags are not an array.
   */
  setTags(tags) {
    this.patcher.patchValue('tags', tags);
    return this;
  }

  /**
   * Gets additional data associated with this Opportunity.
   * @returns {Object} - The additional data for the Opportunity.
   */
  getData() {
    return this.record.data;
  }

  /**
   * Sets additional data for this Opportunity.
   * @param {Object} data - The data to set for the Opportunity.
   * @returns {Opportunity} - The current instance of Opportunity for chaining.
   * @throws {Error} - Throws an error if the data is not a valid object.
   */
  setData(data) {
    this.patcher.patchValue('data', data);
    return this;
  }
}

export default Opportunity;
