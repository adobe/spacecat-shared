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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeTimestamps } from '../../../src/util/util.js';
import DataAccessError from '../../../src/errors/data-access.error.js';
import SiteImsOrgAccessCollection from '../../../src/models/site-ims-org-access/site-ims-org-access.collection.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { IT_HOOK_TIMEOUT } from '../util/util.js';

use(chaiAsPromised);

describe('SiteImsOrgAccess IT', async () => {
  let sampleData;
  let SiteImsOrgAccess;

  before(async function () {
    this.timeout(IT_HOOK_TIMEOUT);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SiteImsOrgAccess = dataAccess.SiteImsOrgAccess;
  });

  it('gets a site ims org access by id', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const access = await SiteImsOrgAccess.findById(sample.getId());

    expect(access).to.be.an('object');
    expect(
      sanitizeTimestamps(access.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sample.toJSON()),
    );
  });

  it('gets all accesses by site id', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const siteId = sample.getSiteId();

    const accesses = await SiteImsOrgAccess.allBySiteId(siteId);

    expect(accesses).to.be.an('array');
    expect(accesses.length).to.be.greaterThan(0);

    for (const access of accesses) {
      expect(access.getSiteId()).to.equal(siteId);
    }
  });

  it('gets all accesses by organization id', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const organizationId = sample.getOrganizationId();

    const accesses = await SiteImsOrgAccess.allByOrganizationId(organizationId);

    expect(accesses).to.be.an('array');
    expect(accesses.length).to.be.greaterThan(0);

    for (const access of accesses) {
      expect(access.getOrganizationId()).to.equal(organizationId);
    }
  });

  it('adds a new site ims org access', async () => {
    const data = {
      siteId: sampleData.sites[2].getId(),
      organizationId: sampleData.organizations[0].getId(),
      targetOrganizationId: sampleData.organizations[2].getId(),
      productCode: 'ACO',
      role: 'viewer',
      grantedBy: 'system',
      updatedBy: 'system',
    };

    const access = await SiteImsOrgAccess.create(data);

    expect(access).to.be.an('object');
    expect(access.getProductCode()).to.equal('ACO');
    expect(access.getRole()).to.equal('viewer');
    expect(access.getGrantedBy()).to.equal('system');
  });

  it('returns existing grant on idempotent create', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const data = {
      siteId: sample.getSiteId(),
      organizationId: sample.getOrganizationId(),
      productCode: sample.getProductCode(),
      targetOrganizationId: sample.getTargetOrganizationId(),
      role: 'agency',
      updatedBy: 'system',
    };

    const result = await SiteImsOrgAccess.create(data);

    expect(result.getId()).to.equal(sample.getId());
  });

  it('rejects create with DataAccessError when the active-delegate limit is reached', async () => {
    const siteId = sampleData.siteImsOrgAccesses[0].getSiteId();
    // Determine current count so we can cap at exactly that many
    const existing = await SiteImsOrgAccess.allBySiteId(siteId);
    const originalMax = SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE;
    SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE = existing.length;

    try {
      const data = {
        siteId,
        organizationId: sampleData.organizations[1].getId(),
        targetOrganizationId: sampleData.organizations[0].getId(),
        productCode: 'ASO',
        role: 'viewer',
        updatedBy: 'system',
      };

      let caught;
      try {
        await SiteImsOrgAccess.create(data);
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.instanceof(DataAccessError);
      expect(caught.status).to.equal(409);
      expect(caught.message).to.include('Cannot add delegate');
    } finally {
      SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE = originalMax;
    }
  });

  it('updates a site ims org access', async () => {
    const access = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());

    access.setRole('viewer');
    await access.save();

    const updated = await SiteImsOrgAccess.findById(access.getId());
    expect(updated.getRole()).to.equal('viewer');
  });

  it('gets all grants with embedded target organization data for multiple orgs', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const organizationId = sample.getOrganizationId();

    // eslint-disable-next-line max-len
    const entries = await SiteImsOrgAccess.allByOrganizationIdsWithTargetOrganization([organizationId]);

    expect(entries).to.be.an('array');
    expect(entries.length).to.be.greaterThan(0);

    for (const entry of entries) {
      expect(entry).to.have.property('grant');
      expect(entry).to.have.property('targetOrganization');
      expect(entry.grant.getOrganizationId()).to.equal(organizationId);
      expect(entry.targetOrganization.id).to.equal(entry.grant.getTargetOrganizationId());
    }
  });

  it('gets all grants with embedded target organization data', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const organizationId = sample.getOrganizationId();

    // eslint-disable-next-line max-len
    const entries = await SiteImsOrgAccess.allByOrganizationIdWithTargetOrganization(organizationId);

    expect(entries).to.be.an('array');
    expect(entries.length).to.be.greaterThan(0);

    for (const entry of entries) {
      expect(entry).to.have.property('grant');
      expect(entry).to.have.property('targetOrganization');
      expect(entry.grant.getOrganizationId()).to.equal(organizationId);
      expect(entry.grant.getTargetOrganizationId()).to.be.a('string');
      expect(entry.targetOrganization.id).to.equal(entry.grant.getTargetOrganizationId());
      expect(entry.targetOrganization.imsOrgId).to.be.a('string');
    }
  });

  it('finds a grant by siteId, organizationId and productCode', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];

    const grant = await SiteImsOrgAccess.findBySiteIdAndOrganizationIdAndProductCode(
      sample.getSiteId(),
      sample.getOrganizationId(),
      sample.getProductCode(),
    );

    expect(grant).to.be.an('object');
    expect(grant.getId()).to.equal(sample.getId());
    expect(grant.getSiteId()).to.equal(sample.getSiteId());
    expect(grant.getOrganizationId()).to.equal(sample.getOrganizationId());
    expect(grant.getProductCode()).to.equal(sample.getProductCode());
  });

  it('returns null when no grant matches findBySiteIdAndOrganizationIdAndProductCode', async () => {
    const result = await SiteImsOrgAccess.findBySiteIdAndOrganizationIdAndProductCode(
      sampleData.siteImsOrgAccesses[0].getSiteId(),
      sampleData.siteImsOrgAccesses[0].getOrganizationId(),
      'ACO', // different productCode — no fixture has this combination
    );

    expect(result).to.be.null;
  });

  it('gets all grants with embedded site data for a delegate organization', async () => {
    const sample = sampleData.siteImsOrgAccesses[0];
    const organizationId = sample.getOrganizationId();

    const entries = await SiteImsOrgAccess.allByOrganizationIdWithSites(organizationId);

    expect(entries).to.be.an('array');
    expect(entries.length).to.be.greaterThan(0);

    for (const entry of entries) {
      expect(entry).to.have.property('grant');
      expect(entry).to.have.property('site');
      expect(entry.grant.getOrganizationId()).to.equal(organizationId);
      expect(entry.grant.getSiteId()).to.be.a('string');
      expect(entry.site).to.be.an('object');
      expect(entry.site.getId()).to.equal(entry.grant.getSiteId());
    }
  });

  it('removes a site ims org access', async () => {
    const access = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());

    await access.remove();

    const notFound = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());
    expect(notFound).to.be.null;
  });
});
