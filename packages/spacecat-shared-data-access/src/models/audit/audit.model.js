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

import { isArray, isObject } from '@adobe/spacecat-shared-utils';

import { ValidationError } from '../../errors/index.js';
import BaseModel from '../base/base.model.js';

/**
 * Audit - A class representing an Audit entity.
 * Provides methods to access and manipulate Audit-specific data.
 *
 * @class Audit
 * @extends BaseModel
 */
class Audit extends BaseModel {
  static AUDIT_TYPES = {
    APEX: 'apex',
    CWV: 'cwv',
    LHS_MOBILE: 'lhs-mobile',
    LHS_DESKTOP: 'lhs-desktop',
    404: '404',
    SITEMAP: 'sitemap',
    CANONICAL: 'canonical',
    BROKEN_BACKLINKS: 'broken-backlinks',
    BROKEN_INTERNAL_LINKS: 'broken-internal-links',
    EXPERIMENTATION: 'experimentation',
    CONVERSION: 'conversion',
    ORGANIC_KEYWORDS: 'organic-keywords',
    ORGANIC_TRAFFIC: 'organic-traffic',
    EXPERIMENTATION_ESS_DAILY: 'experimentation-ess-daily',
    EXPERIMENTATION_ESS_MONTHLY: 'experimentation-ess-monthly',
    EXPERIMENTATION_OPPORTUNITIES: 'experimentation-opportunities',
    META_TAGS: 'meta-tags',
    COSTS: 'costs',
    STRUCTURED_DATA: 'structured-data',
    FORMS_OPPORTUNITIES: 'forms-opportunities',
    SITE_DETECTION: 'site-detection',
  };

  static AUDIT_TYPE_PROPERTIES = {
    [Audit.AUDIT_TYPES.LHS_DESKTOP]: ['performance', 'seo', 'accessibility', 'best-practices'],
    [Audit.AUDIT_TYPES.LHS_MOBILE]: ['performance', 'seo', 'accessibility', 'best-practices'],
  };

  static AUDIT_CONFIG = {
    TYPES: Audit.AUDIT_TYPES,
    PROPERTIES: Audit.AUDIT_TYPE_PROPERTIES,
  };

  /**
   * Validates if the auditResult contains the required properties for the given audit type.
   * @param {object} auditResult - The audit result to validate.
   * @param {string} auditType - The type of the audit.
   * @returns {boolean} - True if valid, false otherwise.
   */
  static validateAuditResult = (auditResult, auditType) => {
    if (!isObject(auditResult) && !isArray(auditResult)) {
      throw new ValidationError('Audit result must be an object or array');
    }

    if (isObject(auditResult.runtimeError)) {
      return true;
    }

    if ((
      auditType === Audit.AUDIT_CONFIG.TYPES.LHS_MOBILE
        || auditType === Audit.AUDIT_CONFIG.TYPES.LHS_DESKTOP
    )
      && !isObject(auditResult.scores)) {
      throw new ValidationError(`Missing scores property for audit type '${auditType}'`);
    }

    const expectedProperties = Audit.AUDIT_CONFIG.PROPERTIES[auditType];

    if (expectedProperties) {
      for (const prop of expectedProperties) {
        if (!(prop in auditResult.scores)) {
          throw new ValidationError(`Missing expected property '${prop}' for audit type '${auditType}'`);
        }
      }
    }

    return true;
  };

  getScores() {
    return this.getAuditResult()?.scores;
  }
}

export default Audit;
