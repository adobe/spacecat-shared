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

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('SiteEnrollmentV2 IT', async () => {
  let sampleData;
  let SiteEnrollmentV2;
  let SiteEnrollment;

  beforeEach(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SiteEnrollmentV2 = dataAccess.SiteEnrollmentV2;
    SiteEnrollment = dataAccess.SiteEnrollment;
  });

  it('V2 create should also create original SiteEnrollment', async () => {
    const data = {
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    };

    // Create V2 enrollment
    const v2Enrollment = await SiteEnrollmentV2.create(data);

    // Verify V2 enrollment was created
    expect(v2Enrollment).to.be.an('object');
    expect(v2Enrollment.getEntitlementId()).to.equal(data.entitlementId);
    expect(v2Enrollment.getSiteId()).to.equal(data.siteId);

    // Verify the original SiteEnrollment was also created by querying all by siteId
    const originalEnrollmentsBySiteId = await SiteEnrollment.allBySiteId(data.siteId);
    const matchingBySiteId = originalEnrollmentsBySiteId.find(
      (e) => e.getEntitlementId() === data.entitlementId,
    );

    expect(matchingBySiteId).to.exist;
    expect(matchingBySiteId.getId()).to.be.a('string');
    expect(matchingBySiteId.getSiteId()).to.equal(data.siteId);
    expect(matchingBySiteId.getEntitlementId()).to.equal(data.entitlementId);

    // Verify the original can also be queried by entitlementId
    const originalEnrollmentsByEntitlementId = await SiteEnrollment.allByEntitlementId(
      data.entitlementId,
    );
    const matchingByEntitlementId = originalEnrollmentsByEntitlementId.find(
      (e) => e.getSiteId() === data.siteId,
    );

    expect(matchingByEntitlementId).to.exist;
    expect(matchingByEntitlementId.getId()).to.equal(matchingBySiteId.getId());

    // Verify the original can be retrieved by its UUID ID
    const retrievedById = await SiteEnrollment.findById(matchingBySiteId.getId());
    expect(retrievedById).to.exist;
    expect(retrievedById.getId()).to.equal(matchingBySiteId.getId());
    expect(retrievedById.getSiteId()).to.equal(data.siteId);
    expect(retrievedById.getEntitlementId()).to.equal(data.entitlementId);
  });

  it('creates a new site enrollment with composite key', async () => {
    const data = {
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    };

    const siteEnrollment = await SiteEnrollmentV2.create(data);

    expect(siteEnrollment).to.be.an('object');
    expect(siteEnrollment.getEntitlementId()).to.equal(data.entitlementId);
    expect(siteEnrollment.getSiteId()).to.equal(data.siteId);
  });

  it('gets a site enrollment by composite key (entitlementId + siteId)', async () => {
    // Create an enrollment first
    const data = {
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    };

    const created = await SiteEnrollmentV2.create(data);

    // Retrieve by composite key
    const siteEnrollment = await SiteEnrollmentV2.findByIndexKeys({
      entitlementId: created.getEntitlementId(),
      siteId: created.getSiteId(),
    });

    expect(siteEnrollment).to.be.an('object');
    expect(siteEnrollment.getEntitlementId()).to.equal(data.entitlementId);
    expect(siteEnrollment.getSiteId()).to.equal(data.siteId);
  });

  it('gets all site enrollments by entitlement id', async () => {
    const entitlementId = sampleData.entitlements[0].getId();

    // Create multiple enrollments for the same entitlement
    await SiteEnrollmentV2.create({
      entitlementId,
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    });

    await SiteEnrollmentV2.create({
      entitlementId,
      siteId: sampleData.sites[1].getId(),
      updatedBy: 'system',
    });

    const siteEnrollments = await SiteEnrollmentV2.allByEntitlementId(entitlementId);

    expect(siteEnrollments).to.be.an('array');
    expect(siteEnrollments.length).to.be.greaterThan(0);

    for (const siteEnrollment of siteEnrollments) {
      expect(siteEnrollment.getEntitlementId()).to.equal(entitlementId);
    }
  });

  it('gets all site enrollments by site id', async () => {
    const siteId = sampleData.sites[0].getId();

    // Create multiple enrollments for the same site with different entitlements
    await SiteEnrollmentV2.create({
      entitlementId: sampleData.entitlements[0].getId(),
      siteId,
      updatedBy: 'system',
    });

    await SiteEnrollmentV2.create({
      entitlementId: sampleData.entitlements[1].getId(),
      siteId,
      updatedBy: 'system',
    });

    const siteEnrollments = await SiteEnrollmentV2.allBySiteId(siteId);

    expect(siteEnrollments).to.be.an('array');
    expect(siteEnrollments.length).to.be.greaterThan(0);

    for (const siteEnrollment of siteEnrollments) {
      expect(siteEnrollment.getSiteId()).to.equal(siteId);
    }
  });

  it('retrieves multiple site enrollments using batchGetByKeys', async () => {
    // Create 3 enrollments
    const enrollment1 = await SiteEnrollmentV2.create({
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    });

    const enrollment2 = await SiteEnrollmentV2.create({
      entitlementId: sampleData.entitlements[1].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    });

    const enrollment3 = await SiteEnrollmentV2.create({
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[1].getId(),
      updatedBy: 'system',
    });

    // Batch get by composite keys
    const keys = [
      {
        entitlementId: enrollment1.getEntitlementId(),
        siteId: enrollment1.getSiteId(),
      },
      {
        entitlementId: enrollment2.getEntitlementId(),
        siteId: enrollment2.getSiteId(),
      },
      {
        entitlementId: enrollment3.getEntitlementId(),
        siteId: enrollment3.getSiteId(),
      },
    ];

    const result = await SiteEnrollmentV2.batchGetByKeys(keys);

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(3);
    expect(result.unprocessed).to.be.an('array');
    expect(result.unprocessed.length).to.equal(0);

    // Verify all three enrollments are returned
    const enrollmentIds = result.data.map((e) => ({
      entitlementId: e.getEntitlementId(),
      siteId: e.getSiteId(),
    }));

    expect(enrollmentIds).to.deep.include({
      entitlementId: enrollment1.getEntitlementId(),
      siteId: enrollment1.getSiteId(),
    });
    expect(enrollmentIds).to.deep.include({
      entitlementId: enrollment2.getEntitlementId(),
      siteId: enrollment2.getSiteId(),
    });
    expect(enrollmentIds).to.deep.include({
      entitlementId: enrollment3.getEntitlementId(),
      siteId: enrollment3.getSiteId(),
    });
  });

  it('removes a site enrollment', async () => {
    const data = {
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    };

    const siteEnrollment = await SiteEnrollmentV2.create(data);

    await siteEnrollment.remove();

    const notFound = await SiteEnrollmentV2.findByIndexKeys({
      entitlementId: siteEnrollment.getEntitlementId(),
      siteId: siteEnrollment.getSiteId(),
    });
    expect(notFound).to.be.null;
  });

  it('V2 removeByIndexKeys should also remove original SiteEnrollment', async () => {
    const data = {
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      updatedBy: 'system',
    };

    // Create V2 enrollment (which also creates original)
    const v2Enrollment = await SiteEnrollmentV2.create(data);

    // Verify both enrollments exist
    const v2Found = await SiteEnrollmentV2.findByIndexKeys({
      entitlementId: data.entitlementId,
      siteId: data.siteId,
    });
    expect(v2Found).to.exist;

    const originalEnrollments = await SiteEnrollment.allBySiteId(data.siteId);
    const originalFound = originalEnrollments.find(
      (e) => e.getEntitlementId() === data.entitlementId,
    );
    expect(originalFound).to.exist;

    // Remove using V2 removeByIndexKeys
    await SiteEnrollmentV2.removeByIndexKeys([{
      entitlementId: v2Enrollment.getEntitlementId(),
      siteId: v2Enrollment.getSiteId(),
    }]);

    // Verify V2 enrollment is removed
    const v2NotFound = await SiteEnrollmentV2.findByIndexKeys({
      entitlementId: data.entitlementId,
      siteId: data.siteId,
    });
    expect(v2NotFound).to.be.null;

    // Verify original enrollment is also removed
    const originalEnrollmentsAfter = await SiteEnrollment.allBySiteId(data.siteId);
    const originalNotFound = originalEnrollmentsAfter.find(
      (e) => e.getEntitlementId() === data.entitlementId,
    );
    expect(originalNotFound).to.be.undefined;
  });
});
