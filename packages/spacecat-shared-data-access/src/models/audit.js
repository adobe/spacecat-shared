/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { hasText, isIsoDate, isObject } from '@adobe/spacecat-shared-utils';
import { Base } from './base.js';

export const AUDIT_TYPE_404 = '404';
export const AUDIT_TYPE_BROKEN_BACKLINKS = 'broken-backlinks';
export const AUDIT_TYPE_ORGANIC_KEYWORDS = 'organic-keywords';
export const AUDIT_TYPE_CWV = 'cwv';
export const AUDIT_TYPE_LHS_DESKTOP = 'lhs-desktop';
export const AUDIT_TYPE_LHS_MOBILE = 'lhs-mobile';

const EXPIRES_IN_DAYS = 30;

const AUDIT_TYPE_PROPERTIES = {
  [AUDIT_TYPE_404]: [],
  [AUDIT_TYPE_BROKEN_BACKLINKS]: [],
  [AUDIT_TYPE_ORGANIC_KEYWORDS]: [],
  [AUDIT_TYPE_CWV]: [],
  [AUDIT_TYPE_LHS_DESKTOP]: ['performance', 'seo', 'accessibility', 'best-practices'],
  [AUDIT_TYPE_LHS_MOBILE]: ['performance', 'seo', 'accessibility', 'best-practices'],
};

/**
 * Validates if the auditResult contains the required properties for the given audit type.
 * @param {object} auditResult - The audit result to validate.
 * @param {string} auditType - The type of the audit.
 * @returns {boolean} - True if valid, false otherwise.
 */
const validateScores = (auditResult, auditType) => {
  if (isObject(auditResult.runtimeError)) {
    return true;
  }

  if ((auditType === AUDIT_TYPE_LHS_DESKTOP
      || auditType === AUDIT_TYPE_LHS_MOBILE
      || auditType === AUDIT_TYPE_CWV)
      && !isObject(auditResult.scores)) {
    throw new Error(`Missing scores property for audit type '${auditType}'`);
  }

  const expectedProperties = AUDIT_TYPE_PROPERTIES[auditType];
  if (!expectedProperties) {
    throw new Error(`Unknown audit type: ${auditType}`);
  }

  for (const prop of expectedProperties) {
    if (!(prop in auditResult.scores)) {
      throw new Error(`Missing expected property '${prop}' for audit type '${auditType}'`);
    }
  }

  return true;
};

/**
 * Creates a new Audit.
 * @param {object } data - audit data
 * @returns {Readonly<Audit>} audit - new audit
 */
const Audit = (data = {}) => {
  const self = Base(data);

  self.getSiteId = () => self.state.siteId;
  self.getAuditedAt = () => self.state.auditedAt;
  self.getAuditResult = () => self.state.auditResult;
  self.getAuditType = () => self.state.auditType.toLowerCase();
  self.getExpiresAt = () => self.state.expiresAt;
  self.getFullAuditRef = () => self.state.fullAuditRef;
  self.isLive = () => self.state.isLive;
  self.isError = () => hasText(self.getAuditResult().runtimeError?.code);
  self.getPreviousAuditResult = () => self.state.previousAuditResult;
  self.setPreviousAuditResult = (previousAuditResult) => {
    validateScores(previousAuditResult, self.getAuditType());
    self.state.previousAuditResult = previousAuditResult;
  };
  self.getScores = () => self.getAuditResult().scores;

  return Object.freeze(self);
};

/**
 * Creates a new Audit.
 *
 * @param {object} data - audit data
 * @returns {Readonly<Audit>} audit - new audit
 */
export const createAudit = (data) => {
  const newState = { ...data };

  if (!hasText(newState.siteId)) {
    throw new Error('Site ID must be provided');
  }

  if (!isIsoDate(newState.auditedAt)) {
    throw new Error('Audited at must be a valid ISO date');
  }

  if (!hasText(newState.auditType)) {
    throw new Error('Audit type must be provided');
  }

  if (!isObject(newState.auditResult)) {
    throw new Error('Audit result must be an object');
  }

  if (!newState.auditResult.scores) {
    newState.auditResult.scores = {};
  }
  validateScores(data.auditResult, data.auditType);

  if (data.previousAuditResult && !isObject(data.previousAuditResult)) {
    throw new Error('Previous audit result must be an object');
  }

  if (data.previousAuditResult) {
    validateScores(data.previousAuditResult, data.auditType);
  }

  if (!hasText(newState.fullAuditRef)) {
    throw new Error('Full audit ref must be provided');
  }

  if (!newState.expiresAt) {
    newState.expiresAt = new Date(newState.auditedAt);
    newState.expiresAt.setDate(newState.expiresAt.getDate() + EXPIRES_IN_DAYS);
  }

  if (!Object.prototype.hasOwnProperty.call(newState, 'isLive')) {
    newState.isLive = false;
  }

  return Audit(newState);
};
