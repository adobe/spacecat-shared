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

import { expect } from 'chai';
import contactSalesLeadSchema from '../../../../src/models/contact-sales-lead/contact-sales-lead.schema.js';

describe('ContactSalesLead Schema', () => {
  describe('name attribute', () => {
    it('should have name as required', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const nameAttr = attributes.name;

      expect(nameAttr).to.exist;
      expect(nameAttr.required).to.be.true;
      expect(nameAttr.type).to.equal('string');
    });
  });

  describe('email attribute', () => {
    it('should have email as required', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const emailAttr = attributes.email;

      expect(emailAttr).to.exist;
      expect(emailAttr.required).to.be.true;
      expect(emailAttr.type).to.equal('string');
    });
  });

  describe('domain attribute', () => {
    it('should have domain as optional', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const domainAttr = attributes.domain;

      expect(domainAttr).to.exist;
      expect(domainAttr.required).to.not.be.true;
      expect(domainAttr.type).to.equal('string');
    });
  });

  describe('notes attribute', () => {
    it('should have notes as optional', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const notesAttr = attributes.notes;

      expect(notesAttr).to.exist;
      expect(notesAttr.required).to.not.be.true;
      expect(notesAttr.type).to.equal('string');
    });
  });

  describe('status attribute', () => {
    it('should have status as required with default NEW', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr).to.exist;
      expect(statusAttr.required).to.be.true;
      expect(statusAttr.default).to.equal('NEW');
      expect(statusAttr.type).to.deep.equal(['NEW', 'CONTACTED', 'CLOSED']);
    });

    it('should include all valid status values', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr.type).to.include('NEW');
      expect(statusAttr.type).to.include('CONTACTED');
      expect(statusAttr.type).to.include('CLOSED');
    });

    it('should not include invalid status values', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr.type).to.not.include('PENDING');
      expect(statusAttr.type).to.not.include('DELETED');
    });
  });

  describe('references', () => {
    it('should have organizationId from belongs_to Organization reference', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      expect(attributes.organizationId).to.exist;
    });

    it('should have siteId from belongs_to Site reference', () => {
      const attributes = contactSalesLeadSchema.getAttributes();
      expect(attributes.siteId).to.exist;
    });
  });
});
