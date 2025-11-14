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
import { PLATFORM_TYPES } from './audit-url.schema.js';

/**
 * AuditUrl - A class representing an AuditUrl entity.
 * Provides methods to access and manipulate AuditUrl-specific data.
 *
 * @class AuditUrl
 * @extends BaseModel
 */
class AuditUrl extends BaseModel {
  static DEFAULT_SOURCE = 'manual';
  static PLATFORM_TYPES = PLATFORM_TYPES;

  /**
   * Checks if this URL is enabled for a specific audit type.
   * @param {string} auditType - The audit type to check.
   * @returns {boolean} True if the audit is enabled for this URL.
   */
  isAuditEnabled(auditType) {
    const audits = (this.getAudits ? this.getAudits() : this.audits) || [];
    return audits.includes(auditType);
  }

  /**
   * Adds an audit type to the audits array if not already present.
   * @param {string} auditType - The audit type to add.
   * @returns {this} The current instance for chaining.
   */
  enableAudit(auditType) {
    const audits = (this.getAudits ? this.getAudits() : this.audits) || [];
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
    const audits = (this.getAudits ? this.getAudits() : this.audits) || [];
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
   * Checks if this URL was manually created by a user.
   * @returns {boolean} True if the source is manual.
   */
  isManualSource() {
    const source = this.getSource ? this.getSource() : this.source;
    return source === AuditUrl.DEFAULT_SOURCE;
  }

  /**
   * Checks if this URL represents an offsite platform (not the primary site).
   * @returns {boolean} True if this is an offsite platform URL.
   */
  isOffsitePlatform() {
    const platformType = this.getPlatformType ? this.getPlatformType() : this.platformType;
    return platformType && platformType !== PLATFORM_TYPES.PRIMARY_SITE;
  }

  /**
   * Checks if this URL is of a specific platform type.
   * @param {string} type - The platform type to check.
   * @returns {boolean} True if the URL matches the specified platform type.
   */
  isPlatformType(type) {
    const platformType = this.getPlatformType ? this.getPlatformType() : this.platformType;
    return platformType === type;
  }
}

export default AuditUrl;
