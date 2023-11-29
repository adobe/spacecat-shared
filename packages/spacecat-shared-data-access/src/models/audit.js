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

const EXPIRES_IN_DAYS = 30;

const Audit = (data = {}) => {
  const self = Base(data);

  self.getSiteId = () => self.state.siteId;
  self.getAuditedAt = () => self.state.auditedAt;
  self.getAuditResult = () => self.state.auditResult;
  self.getAuditType = () => self.state.auditType.toLowerCase();
  self.getExpiresAt = () => self.state.expiresAt;
  self.getFullAuditRef = () => self.state.fullAuditRef;

  return Object.freeze(self);
};

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

  if (!hasText(newState.fullAuditRef)) {
    throw new Error('Full audit ref must be provided');
  }

  if (!newState.expiresAt) {
    newState.expiresAt = new Date(newState.auditedAt);
    newState.expiresAt.setDate(newState.expiresAt.getDate() + EXPIRES_IN_DAYS);
  }

  return Audit(newState);
};
