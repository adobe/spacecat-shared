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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import AuditUrl from '../../../../src/models/audit-url/audit-url.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AuditUrlModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      auditUrlId: 'au12345',
      siteId: 'site12345',
      url: 'https://example.com/page',
      byCustomer: true,
      audits: ['accessibility', 'broken-backlinks'],
      createdAt: '2025-10-27T12:00:00.000Z',
      createdBy: 'user@example.com',
      updatedAt: '2025-10-27T12:00:00.000Z',
      updatedBy: 'user@example.com',
    };

    ({
      model: instance,
    } = createElectroMocks(AuditUrl, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the AuditUrl instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('isAuditEnabled', () => {
    it('returns true when audit is enabled', () => {
      expect(instance.isAuditEnabled('accessibility')).to.be.true;
      expect(instance.isAuditEnabled('broken-backlinks')).to.be.true;
    });

    it('returns false when audit is not enabled', () => {
      expect(instance.isAuditEnabled('lhs-mobile')).to.be.false;
      expect(instance.isAuditEnabled('seo')).to.be.false;
    });

    it('handles empty audits array', () => {
      instance.record.audits = [];
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });

    it('handles undefined audits', () => {
      instance.record.audits = undefined;
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });

    it('works with direct property access when getAudits is not available', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = ['accessibility'];
      expect(plainObj.isAuditEnabled('accessibility')).to.be.true;
    });
  });

  describe('enableAudit', () => {
    it('adds audit to the list when not present', () => {
      instance.enableAudit('lhs-mobile');
      expect(instance.getAudits()).to.include('lhs-mobile');
    });

    it('does not add duplicate audits', () => {
      const originalLength = instance.getAudits().length;
      instance.enableAudit('accessibility'); // Already exists
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.enableAudit('seo');
      expect(result).to.equal(instance);
    });

    it('works when starting with empty audits array', () => {
      instance.record.audits = [];
      instance.enableAudit('accessibility');
      expect(instance.getAudits()).to.deep.equal(['accessibility']);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = [];
      plainObj.enableAudit('accessibility');
      expect(plainObj.audits).to.deep.equal(['accessibility']);
    });
  });

  describe('disableAudit', () => {
    it('removes audit from the list when present', () => {
      instance.disableAudit('accessibility');
      expect(instance.getAudits()).to.not.include('accessibility');
    });

    it('does nothing if audit is not in the list', () => {
      const originalLength = instance.getAudits().length;
      instance.disableAudit('seo'); // Not in list
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.disableAudit('accessibility');
      expect(result).to.equal(instance);
    });

    it('handles removing all audits', () => {
      instance.disableAudit('accessibility');
      instance.disableAudit('broken-backlinks');
      expect(instance.getAudits()).to.deep.equal([]);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = ['accessibility', 'seo'];
      plainObj.disableAudit('accessibility');
      expect(plainObj.audits).to.deep.equal(['seo']);
    });
  });

  describe('isCustomerUrl', () => {
    it('returns true for customer-added URL', () => {
      instance.record.byCustomer = true;
      expect(instance.isCustomerUrl()).to.be.true;
    });

    it('returns false for system-added URL', () => {
      instance.record.byCustomer = false;
      expect(instance.isCustomerUrl()).to.be.false;
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.byCustomer = true;
      expect(plainObj.isCustomerUrl()).to.be.true;

      plainObj.byCustomer = false;
      expect(plainObj.isCustomerUrl()).to.be.false;
    });
  });

  describe('method chaining', () => {
    it('allows chaining enableAudit and disableAudit', () => {
      instance
        .enableAudit('seo')
        .enableAudit('lhs-mobile')
        .disableAudit('accessibility');

      expect(instance.isAuditEnabled('seo')).to.be.true;
      expect(instance.isAuditEnabled('lhs-mobile')).to.be.true;
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });
  });

  describe('generateCompositeKeys', () => {
    it('returns composite keys with siteId and url', () => {
      const result = instance.generateCompositeKeys();

      expect(result).to.be.an('object');
      expect(result).to.have.property('siteId');
      expect(result).to.have.property('url');
      expect(result.siteId).to.equal(mockRecord.siteId);
      expect(result.url).to.equal(mockRecord.url);
    });

    it('returns the same values as getSiteId and getUrl methods', () => {
      const result = instance.generateCompositeKeys();

      expect(result.siteId).to.equal(instance.getSiteId());
      expect(result.url).to.equal(instance.getUrl());
    });
  });
});
