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

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('SiteEnrollment IT', async () => {
  let sampleData;
  let SiteEnrollment;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SiteEnrollment = dataAccess.SiteEnrollment;
  });

  it('gets a site enrollment by id', async () => {
    const sampleSiteEnrollment = sampleData.siteEnrollments[0];
    const siteEnrollment = await SiteEnrollment.findById(sampleSiteEnrollment.getId());

    expect(siteEnrollment).to.be.an('object');
    expect(
      sanitizeTimestamps(siteEnrollment.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleSiteEnrollment.toJSON()),
    );
  });

  it('gets all site enrollments by site id', async () => {
    const sampleSiteEnrollment = sampleData.siteEnrollments[0];
    const siteId = sampleSiteEnrollment.getSiteId();

    const siteEnrollments = await SiteEnrollment.allBySiteId(siteId);

    expect(siteEnrollments).to.be.an('array');
    expect(siteEnrollments.length).to.be.greaterThan(0);

    for (const siteEnrollment of siteEnrollments) {
      expect(siteEnrollment.getSiteId()).to.equal(siteId);
    }
  });

  it('gets all site enrollments by entitlement id', async () => {
    const sampleSiteEnrollment = sampleData.siteEnrollments[0];
    const entitlementId = sampleSiteEnrollment.getEntitlementId();

    const siteEnrollments = await SiteEnrollment.allByEntitlementId(entitlementId);

    expect(siteEnrollments).to.be.an('array');
    expect(siteEnrollments.length).to.be.greaterThan(0);

    for (const siteEnrollment of siteEnrollments) {
      expect(siteEnrollment.getEntitlementId()).to.equal(entitlementId);
    }
  });

  it('adds a new site enrollment', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      entitlementId: sampleData.entitlements[0].getId(),
      updatedBy: 'system',
    };

    const siteEnrollment = await SiteEnrollment.create(data);

    expect(siteEnrollment).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('SiteEnrollment', siteEnrollment.toJSON()),
    ).to.eql(data);
  });

  it('removes a site enrollment', async () => {
    const siteEnrollment = await SiteEnrollment.findById(sampleData.siteEnrollments[0].getId());

    await siteEnrollment.remove();

    const notFound = await SiteEnrollment.findById(sampleData.siteEnrollments[0].getId());
    expect(notFound).to.be.null;
  });
});
