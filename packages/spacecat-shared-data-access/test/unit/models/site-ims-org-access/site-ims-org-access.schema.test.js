/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';
import siteImsOrgAccessSchema from '../../../../src/models/site-ims-org-access/site-ims-org-access.schema.js';

describe('SiteImsOrgAccess Schema', () => {
  describe('targetOrganizationId attribute', () => {
    it('should be required with UUID validation', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      const attr = attributes.targetOrganizationId;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept a valid UUID', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.targetOrganizationId.validate('71f85d21-14d2-4e6d-ae9a-b8860082fb6d')).to.be.true;
    });

    it('should reject an invalid UUID', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.targetOrganizationId.validate('not-a-uuid')).to.be.false;
    });
  });

  describe('productCode attribute', () => {
    it('should be required with product code enum', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      const attr = attributes.productCode;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.type).to.include('LLMO');
      expect(attr.type).to.include('ASO');
      expect(attr.type).to.include('ACO');
    });
  });

  describe('role attribute', () => {
    it('should be required with default agency', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      const attr = attributes.role;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.default).to.equal('agency');
      expect(attr.type).to.deep.equal(['collaborator', 'agency', 'viewer']);
    });
  });

  describe('grantedBy attribute', () => {
    it('should be optional with prefix validation', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      const attr = attributes.grantedBy;

      expect(attr).to.exist;
      expect(attr.required).to.be.false;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept ims: prefix', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.grantedBy.validate('ims:user123')).to.be.true;
    });

    it('should accept slack: prefix', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.grantedBy.validate('slack:U12345')).to.be.true;
    });

    it('should accept system', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.grantedBy.validate('system')).to.be.true;
    });

    it('should reject invalid prefix', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.grantedBy.validate('invalid:user')).to.be.false;
    });

    it('should accept falsy values (optional field)', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.grantedBy.validate('')).to.be.true;
      expect(attributes.grantedBy.validate(null)).to.be.true;
      expect(attributes.grantedBy.validate(undefined)).to.be.true;
    });
  });

  describe('expiresAt attribute', () => {
    it('should be optional with ISO date validation', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      const attr = attributes.expiresAt;

      expect(attr).to.exist;
      expect(attr.required).to.be.false;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept a valid ISO date', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.expiresAt.validate('2026-12-31T23:59:59.000Z')).to.be.true;
    });

    it('should reject invalid date strings', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.expiresAt.validate('not-a-date')).to.be.false;
    });

    it('should accept falsy values (optional field)', () => {
      const attributes = siteImsOrgAccessSchema.getAttributes();
      expect(attributes.expiresAt.validate('')).to.be.true;
      expect(attributes.expiresAt.validate(null)).to.be.true;
      expect(attributes.expiresAt.validate(undefined)).to.be.true;
    });
  });
});
