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
import fixEntityFixtures from '../../fixtures/fix-entity.fixture.js';

use(chaiAsPromised);

function checkFixEntity(fixEntity) {
  expect(fixEntity).to.be.an('object');
  expect(fixEntity.getId()).to.be.a('string');
  expect(fixEntity.getOpportunityId()).to.be.a('string');
  expect(fixEntity.getStatus()).to.be.a('string');
  expect(fixEntity.getType()).to.be.a('string');
  expect(fixEntity.getChangeDetails()).to.be.an('object');
}

describe('FixEntity IT', async () => {
  let FixEntity;
  let sampleData;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    FixEntity = dataAccess.FixEntity;
  });

  it('finds one fix entity by id', async () => {
    const sampleFixEntity = sampleData.fixEntities[0];
    const fixEntity = await FixEntity.findById(sampleFixEntity.getId());

    expect(fixEntity).to.be.an('object');
    expect(fixEntity.getOpportunityId()).to.equal(fixEntityFixtures[0].opportunityId);
  });

  it('gets all fix entities for an opportunity', async () => {
    const { opportunityId } = fixEntityFixtures[0];

    const fixEntities = await FixEntity.allByOpportunityId(opportunityId);

    expect(fixEntities).to.be.an('array');
    expect(fixEntities.length).to.be.greaterThan(0);

    fixEntities.forEach((fixEntity) => {
      checkFixEntity(fixEntity);
      expect(fixEntity.getOpportunityId()).to.equal(opportunityId);
    });
  });

  it('gets all fix entities for an opportunity by status', async () => {
    const { opportunityId } = fixEntityFixtures[1];

    const fixEntities = await FixEntity.allByOpportunityIdAndStatus(opportunityId, 'FAILED');

    expect(fixEntities).to.be.an('array');
    expect(fixEntities.length).to.be.greaterThan(0);

    fixEntities.forEach((fixEntity) => {
      checkFixEntity(fixEntity);
      expect(fixEntity.getOpportunityId()).to.equal(opportunityId);
      expect(fixEntity.getStatus()).to.equal('FAILED');
    });
  });

  it('creates a fix entity', async () => {
    const data = {
      opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
      status: 'PENDING',
      type: 'CONTENT_UPDATE',
      changeDetails: {
        description: 'Fixes a typo in the content',
        changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
      },
    };

    const fixEntity = await FixEntity.create(data);

    checkFixEntity(fixEntity);

    expect(fixEntity.getOpportunityId()).to.equal(data.opportunityId);
    expect(fixEntity.getStatus()).to.equal(data.status);
    expect(fixEntity.getType()).to.equal(data.type);
  });

  it('updates a fix entity', async () => {
    const fixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    const updates = {
      status: 'DEPLOYED',
    };

    fixEntity.setStatus(updates.status);

    await fixEntity.save();

    const updatedFixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    checkFixEntity(updatedFixEntity);

    expect(updatedFixEntity.getStatus()).to.equal(updates.status);
  });

  it('removes a fix entity', async () => {
    const fixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    await fixEntity.remove();

    const notFound = await FixEntity.findById(sampleData.fixEntities[0].getId());
    expect(notFound).to.equal(null);
  });
});
