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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import { createElectroMocks } from '../../util.js';
import contactSalesLeads from '../../../fixtures/contact-sales-leads.fixture.js';
import { ContactSalesLead } from '../../../../src/models/contact-sales-lead/index.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleLead = contactSalesLeads[0];

describe('ContactSalesLeadModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = { ...sampleLead };
    ({
      model: instance,
    } = createElectroMocks(ContactSalesLead, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ContactSalesLead instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('STATUSES', () => {
    it('has the expected status values', () => {
      expect(ContactSalesLead.STATUSES).to.deep.equal({
        NEW: 'NEW',
        CONTACTED: 'CONTACTED',
        CLOSED: 'CLOSED',
      });
    });
  });

  describe('contactSalesLeadId', () => {
    it('gets contactSalesLeadId', () => {
      expect(instance.getId()).to.equal(sampleLead.contactSalesLeadId);
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(instance.getName()).to.equal(sampleLead.name);
    });

    it('sets name', () => {
      instance.setName('New Name');
      expect(instance.record.name).to.equal('New Name');
    });
  });

  describe('email', () => {
    it('gets email', () => {
      expect(instance.getEmail()).to.equal(sampleLead.email);
    });

    it('sets email', () => {
      instance.setEmail('new@example.com');
      expect(instance.record.email).to.equal('new@example.com');
    });
  });

  describe('domain', () => {
    it('gets domain', () => {
      expect(instance.getDomain()).to.equal(sampleLead.domain);
    });

    it('sets domain', () => {
      instance.setDomain('newdomain.com');
      expect(instance.record.domain).to.equal('newdomain.com');
    });
  });

  describe('notes', () => {
    it('gets notes', () => {
      expect(instance.getNotes()).to.equal(sampleLead.notes);
    });

    it('sets notes', () => {
      instance.setNotes('Updated notes');
      expect(instance.record.notes).to.equal('Updated notes');
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal(sampleLead.status);
    });

    it('sets status to CONTACTED', () => {
      instance.setStatus('CONTACTED');
      expect(instance.record.status).to.equal('CONTACTED');
    });

    it('sets status to CLOSED', () => {
      instance.setStatus('CLOSED');
      expect(instance.record.status).to.equal('CLOSED');
    });
  });

  describe('createdAt', () => {
    it('gets createdAt', () => {
      expect(instance.getCreatedAt()).to.equal(sampleLead.createdAt);
    });
  });

  describe('updatedAt', () => {
    it('gets updatedAt', () => {
      expect(instance.getUpdatedAt()).to.equal(sampleLead.updatedAt);
    });
  });
});
