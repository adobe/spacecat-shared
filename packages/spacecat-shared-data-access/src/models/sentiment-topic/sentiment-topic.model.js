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
 * SentimentTopic - A class representing a sentiment analysis topic.
 * Topics define what to analyze (e.g., "BMW XM Latest", "2026 Corvette Stingray").
 *
 * @class SentimentTopic
 * @extends BaseModel
 */
class SentimentTopic extends BaseModel {
  static ENTITY_NAME = 'SentimentTopic';

  /**
   * Checks if this topic is enabled for a specific audit type.
   * @param {string} auditType - The audit type to check.
   * @returns {boolean} True if the audit is enabled for this topic.
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
   * Adds a sub-prompt to the topic.
   * @param {string} prompt - The prompt to add.
   * @returns {this} The current instance for chaining.
   */
  addSubPrompt(prompt) {
    const subPrompts = this.getSubPrompts?.() ?? this.subPrompts ?? [];
    const updated = [...subPrompts, prompt];
    if (this.setSubPrompts) {
      this.setSubPrompts(updated);
    } else {
      this.subPrompts = updated;
    }
    return this;
  }

  /**
   * Removes a sub-prompt from the topic.
   * @param {string} prompt - The prompt to remove.
   * @returns {this} The current instance for chaining.
   */
  removeSubPrompt(prompt) {
    const subPrompts = this.getSubPrompts?.() ?? this.subPrompts ?? [];
    const filtered = subPrompts.filter((p) => p !== prompt);
    if (this.setSubPrompts) {
      this.setSubPrompts(filtered);
    } else {
      this.subPrompts = filtered;
    }
    return this;
  }
}

export default SentimentTopic;
