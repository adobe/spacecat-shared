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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('SiteImsOrgAccess IT', async () => {
  let sampleData;
  let SiteImsOrgAccess;

  before(async function () {
    this.timeout(10000);
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

  it('updates a site ims org access', async () => {
    const access = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());

    access.setRole('viewer');
    await access.save();

    const updated = await SiteImsOrgAccess.findById(access.getId());
    expect(updated.getRole()).to.equal('viewer');
  });

  it('removes a site ims org access', async () => {
    const access = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());

    await access.remove();

    const notFound = await SiteImsOrgAccess.findById(sampleData.siteImsOrgAccesses[1].getId());
    expect(notFound).to.be.null;
  });
});
