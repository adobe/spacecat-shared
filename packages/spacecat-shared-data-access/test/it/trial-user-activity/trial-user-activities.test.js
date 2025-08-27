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

describe('TrialUserActivity IT', async () => {
  let sampleData;
  let TrialUserActivity;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    TrialUserActivity = dataAccess.TrialUserActivity;
    // console.log(`schema here: ${TrialUserActivity.schema}`);
  });

  it('gets a trialUserActivity by id', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[0];
    const trialUserActivity = await TrialUserActivity.findById(sampleTrialUserActivity.getId());

    expect(trialUserActivity).to.be.an('object');
    expect(
      sanitizeTimestamps(trialUserActivity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleTrialUserActivity.toJSON()),
    );
  });

  it('gets all trialUserActivities by entitlementId', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[0];
    const entitlementId = sampleTrialUserActivity.getEntitlementId();

    const allTrialUserActivities = await TrialUserActivity.allByEntitlementId(entitlementId);

    expect(allTrialUserActivities).to.be.an('array');
    expect(allTrialUserActivities.length).to.equal(3);

    for (const trialUserActivity of allTrialUserActivities) {
      expect(trialUserActivity.getTrialUserId()).to.equal(sampleTrialUserActivity.getTrialUserId());
    }
  });

  it('gets all trialUserActivities by productCode', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[1];
    const productCode = sampleTrialUserActivity.getProductCode();

    const allTrialUserActivities = await TrialUserActivity.allByProductCode(productCode);

    expect(allTrialUserActivities).to.be.an('array');
    expect(allTrialUserActivities.length).to.equal(2);

    for (const trialUserActivity of allTrialUserActivities) {
      expect(trialUserActivity.getCreatedAt()).to.equal(sampleTrialUserActivity.getCreatedAt());
    }
  });

  it('gets all trialUserActivities by productCode and createdAt', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[0];
    const productCode = sampleTrialUserActivity.getProductCode();
    const createdAt = sampleTrialUserActivity.getCreatedAt();

    const allTrialUserActivities = await TrialUserActivity.allByProductCodeAndCreatedAt(
      productCode,
      createdAt,
    );

    expect(allTrialUserActivities).to.be.an('array');
    expect(allTrialUserActivities.length).to.equal(3);

    for (const trialUserActivity of allTrialUserActivities) {
      expect(trialUserActivity.getProductCode()).to.equal(productCode);
      expect(trialUserActivity.getCreatedAt()).to.equal(createdAt);
    }
  });

  it('gets all trialUserActivities by siteId', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[1];
    const siteId = sampleTrialUserActivity.getSiteId();

    const allTrialUserActivities = await TrialUserActivity.allBySiteId(siteId);

    expect(allTrialUserActivities).to.be.an('array');
    expect(allTrialUserActivities.length).to.equal(1);

    for (const trialUserActivity of allTrialUserActivities) {
      expect(trialUserActivity.getCreatedAt()).to.equal(sampleTrialUserActivity.getCreatedAt());
    }
  });

  it('adds a new trialUserActivity', async () => {
    const data = {
      trialUserId: 'c7faffcc-cc68-4f66-9020-fa71b67cce6d',
      entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
      siteId: '48656b02-62cb-46c0-b271-ee99c940e89e',
      type: 'PROMPT_RUN',
      details: {
        promptType: 'seo_optimization',
        tokensUsed: 200,
        responseLength: 600,
      },
      productCode: 'LLMO',
      updatedBy: 'system',
    };

    const trialUserActivities = await TrialUserActivity.create(data);

    expect(trialUserActivities).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('trialUserActivities', trialUserActivities.toJSON()),
    ).to.eql(data);
  });

  it('removes an trialUserActivity', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[0];
    const trialUserActivity = await TrialUserActivity.findById(sampleTrialUserActivity.getId());

    await trialUserActivity.remove();

    const notFound = await TrialUserActivity.findById(sampleTrialUserActivity.getId());
    expect(notFound).to.be.null;
  });
});
