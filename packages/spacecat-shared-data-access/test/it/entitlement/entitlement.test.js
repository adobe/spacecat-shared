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

describe('Entitlement IT', async () => {
  let sampleData;
  let Entitlement;
  let SiteEnrollment;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Entitlement = dataAccess.Entitlement;
    SiteEnrollment = dataAccess.SiteEnrollment;
  });

  it('gets an entitlement by id', async () => {
    const sampleEntitlement = sampleData.entitlements[0];
    const entitlement = await Entitlement.findById(sampleEntitlement.getId());

    expect(entitlement).to.be.an('object');
    expect(
      sanitizeTimestamps(entitlement.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleEntitlement.toJSON()),
    );
  });

  it('gets all entitlements by organization id', async () => {
    const sampleEntitlement = sampleData.entitlements[0];
    const organizationId = sampleEntitlement.getOrganizationId();

    const entitlements = await Entitlement.allByOrganizationId(organizationId);

    expect(entitlements).to.be.an('array');
    expect(entitlements.length).to.be.greaterThan(0);

    for (const entitlement of entitlements) {
      expect(entitlement.getOrganizationId()).to.equal(organizationId);
    }
  });

  it('gets all entitlements by organization id and product code', async () => {
    const sampleEntitlement = sampleData.entitlements[0];
    const organizationId = sampleEntitlement.getOrganizationId();
    const productCode = sampleEntitlement.getProductCode();

    const entitlements = await Entitlement.allByOrganizationIdAndProductCode(
      organizationId,
      productCode,
    );

    expect(entitlements).to.be.an('array');
    expect(entitlements.length).to.be.greaterThan(0);

    for (const entitlement of entitlements) {
      expect(entitlement.getOrganizationId()).to.equal(organizationId);
      expect(entitlement.getProductCode()).to.equal(productCode);
    }
  });

  it('adds a new entitlement', async () => {
    const data = {
      organizationId: sampleData.organizations[0].getId(),
      productCode: 'LLMO',
      tier: 'FREE_TRIAL',
      quotas: {
        llmo_trial_prompts: 500,
      },
      updatedBy: 'system',
    };

    const entitlement = await Entitlement.create(data);

    expect(entitlement).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('Entitlement', entitlement.toJSON()),
    ).to.eql(data);
  });

  it('updates the quota of an entitlement', async () => {
    const entitlement = await Entitlement.findById(sampleData.entitlements[0].getId());

    const newQuotas = {
      llmo_trial_prompts: 300,
    };
    const expectedEntitlement = {
      ...entitlement.toJSON(),
      quotas: newQuotas,
    };
    entitlement.setQuotas(newQuotas);
    await entitlement.save();

    const updatedEntitlement = await Entitlement.findById(entitlement.getId());
    expect(updatedEntitlement.getId()).to.equal(entitlement.getId());
    expect(updatedEntitlement.record.createdAt).to.equal(entitlement.record.createdAt);
    expect(
      sanitizeIdAndAuditFields('Entitlement', updatedEntitlement.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Entitlement', expectedEntitlement),
    );
  });

  it('updates an entitlement tier', async () => {
    const entitlement = await Entitlement.findById(sampleData.entitlements[0].getId());
    const newTier = 'PAID';

    const expectedEntitlement = {
      ...entitlement.toJSON(),
      tier: newTier,
    };
    entitlement.setTier(newTier);
    await entitlement.save();

    const updatedEntitlement = await Entitlement.findById(entitlement.getId());

    expect(updatedEntitlement.getId()).to.equal(entitlement.getId());
    expect(updatedEntitlement.record.createdAt).to.equal(entitlement.record.createdAt);
    expect(
      sanitizeIdAndAuditFields('Entitlement', updatedEntitlement.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Entitlement', expectedEntitlement),
    );
  });

  it('removes an entitlement', async () => {
    const entitlement = await Entitlement.findById(sampleData.entitlements[0].getId());

    await entitlement.remove();

    const notFound = await Entitlement.findById(sampleData.entitlements[0].getId());
    expect(notFound).to.be.null;
  });

  it('removes an entitlement and its dependent site enrollments', async () => {
    const entitlement = await Entitlement.findById(sampleData.entitlements[1].getId());
    const siteEnrollments = await entitlement.getSiteEnrollments();

    expect(siteEnrollments).to.be.an('array').with.length.greaterThan(0);

    await entitlement.remove();

    const notFound = await Entitlement.findById(sampleData.entitlements[1].getId());
    expect(notFound).to.be.null;

    // verify that dependent site enrollments are removed as well
    await Promise.all(siteEnrollments.map(async (siteEnrollment) => {
      const notFoundEnrollment = await SiteEnrollment.findById(siteEnrollment.getId());
      expect(notFoundEnrollment).to.be.null;
    }));
  });
});
