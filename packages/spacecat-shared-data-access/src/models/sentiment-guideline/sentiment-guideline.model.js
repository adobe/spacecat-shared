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

import BaseModel from '../base/base.model.js';

/**
 * SentimentGuideline - A class representing a sentiment analysis guideline.
 * Guidelines define how to analyze topics (e.g., "Focus on product quality").
 *
 * @class SentimentGuideline
 * @extends BaseModel
 */
class SentimentGuideline extends BaseModel {
  static ENTITY_NAME = 'SentimentGuideline';

  /**
   * Checks if this guideline is currently enabled.
   * @returns {boolean} True if the guideline is enabled.
   */
  isEnabled() {
    return this.getEnabled?.() ?? this.enabled ?? true;
  }

  /**
   * Checks if this guideline is enabled for a specific audit type.
   * @param {string} auditType - The audit type to check.
   * @returns {boolean} True if the audit is enabled for this guideline.
   */
  isAuditEnabled(auditType) {
    const audits = this.getAudits?.() ?? this.audits ?? [];
    return audits.includes(auditType);
  }

  /**
   * Adds an audit type to the audits array if not already present.
   * @param {string} auditType - The audit type to add.
   * @returns {this} The current instance for chaining.
   */
  enableAudit(auditType) {
    const audits = this.getAudits?.() ?? this.audits ?? [];
    if (!audits.includes(auditType)) {
      const updatedAudits = [...audits, auditType];
      if (this.setAudits) {
        this.setAudits(updatedAudits);
      } else {
        this.audits = updatedAudits;
      }
    }
    return this;
  }

  /**
   * Removes an audit type from the audits array.
   * @param {string} auditType - The audit type to remove.
   * @returns {this} The current instance for chaining.
   */
  disableAudit(auditType) {
    const audits = this.getAudits?.() ?? this.audits ?? [];
    const filtered = audits.filter((a) => a !== auditType);
    if (this.setAudits) {
      this.setAudits(filtered);
    } else {
      this.audits = filtered;
    }
    return this;
  }

  /**
   * Generates the composite keys for remove/update operations.
   * Required for entities with composite primary keys.
   * @returns {Object} - The composite keys (siteId + guidelineId).
   */
  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      guidelineId: this.getGuidelineId(),
    };
  }
}

export default SentimentGuideline;
