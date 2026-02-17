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

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    TrialUserActivity = dataAccess.TrialUserActivity;
  });

  it('gets a trialUserActivity by id', async () => {
    const sampleTrialUserActivity = sampleData.trialUserActivities[0];
    const trialUserActivity = await TrialUserActivity.findById(sampleTrialUserActivity.getId());

    expect(trialUserActivity).to.be.an('object');
    expect(trialUserActivity.getType()).to.equal(sampleTrialUserActivity.getType());
    expect(trialUserActivity.getDetails()).to.deep.equal(sampleTrialUserActivity.getDetails());
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
      expect(trialUserActivity.getType()).to.be.a('string');
      expect(['SIGN_UP', 'CREATE_SITE', 'RUN_AUDIT', 'PROMPT_RUN', 'DOWNLOAD', 'SIGN_IN']).to.include(trialUserActivity.getType());
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
      expect(trialUserActivity.getProductCode()).to.equal(productCode);
      expect(trialUserActivity.getType()).to.be.a('string');
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
      expect(trialUserActivity.getSiteId()).to.equal(siteId);
      expect(trialUserActivity.getType()).to.be.a('string');

      if (trialUserActivity.getDetails()) {
        expect(trialUserActivity.getDetails()).to.be.an('object');
      }
    }
  });

  it('adds a new trialUserActivity', async () => {
    const data = {
      trialUserId: sampleData.trialUsers[0].getId(),
      entitlementId: sampleData.entitlements[0].getId(),
      siteId: sampleData.sites[0].getId(),
      type: 'PROMPT_RUN',
      details: {
        promptType: 'seo_optimization',
        tokensUsed: 200,
        responseLength: 600,
      },
      productCode: 'LLMO',
      updatedBy: 'system',
    };

    const trialUserActivity = await TrialUserActivity.create(data);

    expect(trialUserActivity).to.be.an('object');
    expect(trialUserActivity.getType()).to.equal('PROMPT_RUN');
    expect(trialUserActivity.getDetails()).to.deep.equal({
      promptType: 'seo_optimization',
      tokensUsed: 200,
      responseLength: 600,
    });

    expect(
      sanitizeIdAndAuditFields('trialUserActivities', trialUserActivity.toJSON()),
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
