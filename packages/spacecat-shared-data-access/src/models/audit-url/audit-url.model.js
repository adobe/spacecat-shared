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

/**
 * AuditUrl - A class representing an AuditUrl entity.
 * Provides methods to access and manipulate AuditUrl-specific data.
 *
 * @class AuditUrl
 * @extends BaseModel
 */
class AuditUrl extends BaseModel {
  static ENTITY_NAME = 'AuditUrl';

  /**
   * Checks if this URL is enabled for a specific audit type.
   * @param {string} auditType - The audit type to check.
   * @returns {boolean} True if the audit is enabled for this URL.
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
      // Create a new array instead of mutating the existing one
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
    // filter() already creates a new array
    const filtered = audits.filter((a) => a !== auditType);
    if (this.setAudits) {
      this.setAudits(filtered);
    } else {
      this.audits = filtered;
    }
    return this;
  }

  /**
   * Checks if this URL was added by a customer.
   * @returns {boolean} True if the URL was added by a customer.
   */
  isCustomerUrl() {
    const byCustomer = this.getByCustomer?.() ?? this.byCustomer;
    return byCustomer === true;
  }

  /**
   * Generates the composite keys for the AuditUrl model.
   * Required for ElectroDB operations with composite primary key (siteId + url).
   * @returns {Object} - The composite keys.
   */
  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      url: this.getUrl(),
    };
  }
}

export default AuditUrl;
