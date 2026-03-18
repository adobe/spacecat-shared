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

/* eslint-env mocha */

import { expect } from 'chai';
import accessGrantLogSchema from '../../../../src/models/access-grant-log/access-grant-log.schema.js';

describe('AccessGrantLog Schema', () => {
  describe('schema constraints', () => {
    it('does not allow updates', () => {
      expect(accessGrantLogSchema.allowsUpdates()).to.be.false;
    });

    it('does not allow removal', () => {
      expect(accessGrantLogSchema.allowsRemove()).to.be.false;
    });
  });
  describe('siteId attribute', () => {
    it('should be required with UUID validation', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.siteId;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept a valid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.siteId.validate('5d6d4439-6659-46c2-b646-92d110fa5a52')).to.be.true;
    });

    it('should reject an invalid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.siteId.validate('not-a-uuid')).to.be.false;
    });
  });

  describe('targetOrganizationId attribute', () => {
    it('should be required with UUID validation', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.targetOrganizationId;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept a valid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.targetOrganizationId.validate('4854e75e-894b-4a74-92bf-d674abad1423')).to.be.true;
    });

    it('should reject an invalid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.targetOrganizationId.validate('not-a-uuid')).to.be.false;
    });
  });

  describe('organizationId attribute', () => {
    it('should be required with UUID validation', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.organizationId;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept a valid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.organizationId.validate('3fe5ca60-4850-431c-97b3-f88a80f07e9b')).to.be.true;
    });

    it('should reject an invalid UUID', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.organizationId.validate('invalid')).to.be.false;
    });
  });

  describe('productCode attribute', () => {
    it('should be required with product code enum', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.productCode;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.type).to.include('LLMO');
      expect(attr.type).to.include('ASO');
      expect(attr.type).to.include('ACO');
    });
  });

  describe('action attribute', () => {
    it('should be required with grant/revoke enum', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.action;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.type).to.deep.equal(['grant', 'revoke']);
    });
  });

  describe('role attribute', () => {
    it('should be required with DELEGATION_ROLES enum', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.role;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.type).to.deep.equal(['collaborator', 'agency', 'viewer']);
    });
  });

  describe('performedBy attribute', () => {
    it('should be required with prefix validation', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      const attr = attributes.performedBy;

      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('should accept ims: prefix', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.performedBy.validate('ims:user123')).to.be.true;
    });

    it('should accept slack: prefix', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.performedBy.validate('slack:U12345')).to.be.true;
    });

    it('should accept system', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.performedBy.validate('system')).to.be.true;
    });

    it('should reject invalid prefix', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.performedBy.validate('invalid:user')).to.be.false;
    });

    it('should reject empty string', () => {
      const attributes = accessGrantLogSchema.getAttributes();
      expect(attributes.performedBy.validate('')).to.be.false;
    });
  });
});
