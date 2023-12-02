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

/* eslint-env mocha */

import { expect } from 'chai';
import { createAudit } from '../../../src/models/audit.js';

const validData = {
  siteId: '123',
  auditedAt: new Date().toISOString(),
  auditType: 'lhs-mobile',
  auditResult: {
    performance: 0.9,
    seo: 0.9,
    accessibility: 0.9,
    'best-practices': 0.9,
  },
  fullAuditRef: 'ref123',
};

describe('Audit Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if siteId is not provided', () => {
      expect(() => createAudit({ ...validData, siteId: '' })).to.throw('Site ID must be provided');
    });

    it('throws an error if auditedAt is not a valid ISO date', () => {
      expect(() => createAudit({ ...validData, auditedAt: 'invalid-date' })).to.throw('Audited at must be a valid ISO date');
    });

    it('throws an error if auditType is not provided', () => {
      expect(() => createAudit({ ...validData, auditType: '' })).to.throw('Audit type must be provided');
    });

    it('throws an error if auditResult is not an object', () => {
      expect(() => createAudit({ ...validData, auditResult: 'not-an-object' })).to.throw('Audit result must be an object');
    });

    it('throws an error if fullAuditRef is not provided', () => {
      expect(() => createAudit({ ...validData, fullAuditRef: '' })).to.throw('Full audit ref must be provided');
    });
  });

  describe('Functionality Tests', () => {
    it('creates an audit object with correct properties', () => {
      const audit = createAudit(validData);
      expect(audit).to.be.an('object');
      expect(audit.getSiteId()).to.equal(validData.siteId);
      expect(audit.getAuditedAt()).to.equal(validData.auditedAt);
      expect(audit.getAuditType()).to.equal(validData.auditType.toLowerCase());
      expect(audit.getAuditResult()).to.deep.equal(validData.auditResult);
      expect(audit.getFullAuditRef()).to.equal(validData.fullAuditRef);
    });

    it('automatically sets expiresAt if not provided', () => {
      const audit = createAudit(validData);
      expect(audit.getExpiresAt()).to.be.a('Date');
      const expectedDate = new Date(validData.auditedAt);
      expectedDate.setDate(expectedDate.getDate() + 30);
      expect(audit.getExpiresAt().toDateString()).to.equal(expectedDate.toDateString());
    });
  });
});
