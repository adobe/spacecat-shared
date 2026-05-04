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

import { isValidUUID } from '@adobe/spacecat-shared-utils';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { sanitizeTimestamps } from '../../../src/util/util.js';

use(chaiAsPromised);

function checkContactSalesLead(lead) {
  expect(lead).to.be.an('object');
  expect(lead.getId()).to.be.a('string');
  expect(lead.getName()).to.be.a('string');
  expect(lead.getEmail()).to.be.a('string');
  expect(lead.getOrganizationId()).to.be.a('string');
  expect(lead.getStatus()).to.be.a('string');
  expect(['NEW', 'CONTACTED', 'CLOSED']).to.include(lead.getStatus());
  expect(lead.getCreatedAt()).to.be.a('string');
  expect(lead.getUpdatedAt()).to.be.a('string');
}

describe('ContactSalesLead IT', async () => {
  const { organizationId } = fixtures.organizations[0];
  let sampleData;
  let ContactSalesLead;

  before(async function () {
    this.timeout(30000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    ContactSalesLead = dataAccess.ContactSalesLead;
  });

  it('finds one lead by ID', async () => {
    const sample = sampleData.contactSalesLeads[0];

    const lead = await ContactSalesLead.findById(sample.getId());

    checkContactSalesLead(lead);

    expect(
      sanitizeTimestamps(lead.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sample.toJSON()),
    );
  });

  it('returns null when lead is not found by ID', async () => {
    const lead = await ContactSalesLead.findById('00000000-0000-0000-0000-000000000000');

    expect(lead).to.be.null;
  });

  it('finds all leads by organization ID', async () => {
    const sample = sampleData.contactSalesLeads[0];
    const testOrgId = sample.getOrganizationId();

    const leads = await ContactSalesLead.allByOrganizationId(testOrgId);

    expect(leads).to.be.an('array');
    expect(leads.length).to.be.greaterThan(0);

    for (const lead of leads) {
      checkContactSalesLead(lead);
      expect(lead.getOrganizationId()).to.equal(testOrgId);
    }
  });

  it('finds single lead by organization ID', async () => {
    const sample = sampleData.contactSalesLeads[0];
    const testOrgId = sample.getOrganizationId();

    const lead = await ContactSalesLead.findByOrganizationId(testOrgId);

    expect(lead).to.not.be.null;
    checkContactSalesLead(lead);
    expect(lead.getOrganizationId()).to.equal(testOrgId);
  });

  it('finds all leads by site ID', async () => {
    const sample = sampleData.contactSalesLeads[0];
    const testSiteId = sample.getSiteId();

    const leads = await ContactSalesLead.allBySiteId(testSiteId);

    expect(leads).to.be.an('array');
    expect(leads.length).to.be.greaterThan(0);

    for (const lead of leads) {
      checkContactSalesLead(lead);
      expect(lead.getSiteId()).to.equal(testSiteId);
    }
  });

  it('adds a new lead with all fields', async () => {
    const data = {
      organizationId,
      siteId: '56a691db-d32e-4308-ac99-a21de0580557',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      domain: 'example.com',
      notes: 'Wants a demo',
    };

    const lead = await ContactSalesLead.create(data);

    checkContactSalesLead(lead);

    expect(isValidUUID(lead.getId())).to.be.true;
    expect(lead.getOrganizationId()).to.equal(data.organizationId);
    expect(lead.getSiteId()).to.equal(data.siteId);
    expect(lead.getName()).to.equal(data.name);
    expect(lead.getEmail()).to.equal(data.email);
    expect(lead.getDomain()).to.equal(data.domain);
    expect(lead.getNotes()).to.equal(data.notes);
    expect(lead.getStatus()).to.equal('NEW'); // default status
  });

  it('adds a new lead without optional fields', async () => {
    const data = {
      organizationId,
      name: 'Bob Minimal',
      email: 'bob@example.com',
    };

    const lead = await ContactSalesLead.create(data);

    checkContactSalesLead(lead);

    expect(isValidUUID(lead.getId())).to.be.true;
    expect(lead.getOrganizationId()).to.equal(data.organizationId);
    expect(lead.getName()).to.equal(data.name);
    expect(lead.getEmail()).to.equal(data.email);
    expect(lead.getStatus()).to.equal('NEW');
  });

  it('updates a lead', async () => {
    const sample = sampleData.contactSalesLeads[0];

    const lead = await ContactSalesLead.findById(sample.getId());

    lead.setName('Updated Name');
    lead.setEmail('updated@example.com');
    lead.setStatus('CONTACTED');
    lead.setNotes('Follow-up scheduled');

    await lead.save();

    checkContactSalesLead(lead);

    expect(lead.getName()).to.equal('Updated Name');
    expect(lead.getEmail()).to.equal('updated@example.com');
    expect(lead.getStatus()).to.equal('CONTACTED');
    expect(lead.getNotes()).to.equal('Follow-up scheduled');
  });

  it('updates lead status to CLOSED', async () => {
    const data = {
      organizationId,
      name: 'To Close',
      email: 'close@example.com',
    };

    const lead = await ContactSalesLead.create(data);
    expect(lead.getStatus()).to.equal('NEW');

    lead.setStatus('CLOSED');
    await lead.save();

    const updated = await ContactSalesLead.findById(lead.getId());
    expect(updated.getStatus()).to.equal('CLOSED');
  });

  it('removes a lead', async () => {
    const data = {
      organizationId,
      name: 'To Delete',
      email: 'delete@example.com',
    };

    const lead = await ContactSalesLead.create(data);
    const leadId = lead.getId();

    await lead.remove();

    const removed = await ContactSalesLead.findById(leadId);
    expect(removed).to.be.null;
  });

  it('traverses belongs_to Organization reference', async () => {
    const sample = sampleData.contactSalesLeads[0];
    const lead = await ContactSalesLead.findById(sample.getId());

    const org = await lead.getOrganization();

    expect(org).to.not.be.null;
    expect(org.getId()).to.equal(lead.getOrganizationId());
  });

  it('traverses belongs_to Site reference when siteId is set', async () => {
    const sample = sampleData.contactSalesLeads[0];
    const lead = await ContactSalesLead.findById(sample.getId());

    // First fixture has a siteId set
    if (lead.getSiteId()) {
      const site = await lead.getSite();

      expect(site).to.not.be.null;
      expect(site.getId()).to.equal(lead.getSiteId());
    }
  });
});
