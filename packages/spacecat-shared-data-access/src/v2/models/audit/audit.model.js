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

import { isObject } from '@adobe/spacecat-shared-utils';

import { BaseModel } from '../base/index.js';

// some of these unused exports are being imported from other projects. Handle with care.
const AUDIT_TYPES = {
  404: '404',
  BROKEN_BACKLINKS: 'broken-backlinks',
  EXPERIMENTATION: 'experimentation',
  ORGANIC_KEYWORDS: 'organic-keywords',
  ORGANIC_TRAFFIC: 'organic-traffic',
  CWV: 'cwv',
  LHS_DESKTOP: 'lhs-desktop',
  LHS_MOBILE: 'lhs-mobile',
  EXPERIMENTATION_ESS_MONTHLY: 'experimentation-ess-monthly',
  EXPERIMENTATION_ESS_DAILY: 'experimentation-ess-daily',
};

// audit type properties for specific types
const AUDIT_TYPE_PROPERTIES = {
  [AUDIT_TYPES.LHS_DESKTOP]: ['performance', 'seo', 'accessibility', 'best-practices'],
  [AUDIT_TYPES.LHS_MOBILE]: ['performance', 'seo', 'accessibility', 'best-practices'],
};

export const AUDIT_CONFIG = {
  TYPES: AUDIT_TYPES,
  PROPERTIES: AUDIT_TYPE_PROPERTIES,
};

/**
 * Validates if the auditResult contains the required properties for the given audit type.
 * @param {object} auditResult - The audit result to validate.
 * @param {string} auditType - The type of the audit.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const validateAuditResult = (auditResult, auditType) => {
  if (!isObject(auditResult) || !Array.isArray(auditResult)) {
    throw new Error('Audit result must be an object or array');
  }

  if (isObject(auditResult.runtimeError)) {
    return true;
  }

  if ((auditType === AUDIT_CONFIG.TYPES.LHS_DESKTOP || auditType === AUDIT_CONFIG.TYPES.LHS_DESKTOP)
    && !isObject(auditResult.scores)) {
    throw new Error(`Missing scores property for audit type '${auditType}'`);
  }

  const expectedProperties = AUDIT_CONFIG.PROPERTIES[auditType];

  if (expectedProperties) {
    for (const prop of expectedProperties) {
      if (!(prop in auditResult.scores)) {
        throw new Error(`Missing expected property '${prop}' for audit type '${auditType}'`);
      }
    }
  }

  return true;
};

/**
 * Audit - A class representing an Audit entity.
 * Provides methods to access and manipulate Audit-specific data.
 *
 * @class Audit
 * @extends BaseModel
 */
class Audit extends BaseModel {
  // add your custom methods or overrides here

  getScores() {
    return this.getAuditResult()?.scores;
  }
}

export default Audit;
