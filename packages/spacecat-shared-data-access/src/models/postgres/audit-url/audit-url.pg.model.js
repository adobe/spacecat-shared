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

class PostgresAuditUrlModel extends PostgresBaseModel {
  static ENTITY_NAME = 'AuditUrl';

  isAuditEnabled(auditType) {
    const audits = this.getAudits?.() ?? this.audits ?? [];
    return audits.includes(auditType);
  }

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

  isCustomerUrl() {
    const byCustomer = this.getByCustomer?.() ?? this.byCustomer;
    return byCustomer === true;
  }

  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      url: this.getUrl(),
    };
  }
}

export default PostgresAuditUrlModel;
