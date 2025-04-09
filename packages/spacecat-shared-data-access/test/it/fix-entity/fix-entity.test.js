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
  expect(fixEntity.getExecutedBy()).to.be.a('string');
  expect(fixEntity.getExecutedAt()).to.be.a('string');
}

describe('FixEntity IT', async () => {
  let FixEntity;

  before(async () => {
    await seedDatabase();

    const dataAccess = getDataAccess();
    FixEntity = dataAccess.FixEntity;
  });

  it('finds one fix entity by id', async () => {
    const fixEntity = await FixEntity.findById(fixEntityFixtures[0].id);

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

  it('creates a fix entity', async () => {
    const data = {
      opportunityId: 'new-opportunity-id',
      status: 'PENDING',
      type: 'CONTENT_UPDATE',
      changeDetails: {
        description: 'Fixes a typo in the content',
        changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
      },
      executedBy: 'developer123',
      executedAt: '2025-04-01T10:00:00Z',
    };

    const fixEntity = await FixEntity.create(data);

    checkFixEntity(fixEntity);

    expect(fixEntity.getOpportunityId()).to.equal(data.opportunityId);
    expect(fixEntity.getStatus()).to.equal(data.status);
    expect(fixEntity.getType()).to.equal(data.type);
  });

  it('updates a fix entity', async () => {
    const fixEntity = await FixEntity.findById(fixEntityFixtures[0].id);

    const updates = {
      status: 'DEPLOYED',
      executedAt: '2025-04-02T10:00:00Z',
    };

    fixEntity.setStatus(updates.status).setExecutedAt(updates.executedAt);

    await fixEntity.save();

    const updatedFixEntity = await FixEntity.findById(fixEntityFixtures[0].id);

    checkFixEntity(updatedFixEntity);

    expect(updatedFixEntity.getStatus()).to.equal(updates.status);
    expect(updatedFixEntity.getExecutedAt()).to.equal(updates.executedAt);
  });

  it('removes a fix entity', async () => {
    const fixEntity = await FixEntity.findById(fixEntityFixtures[0].id);

    await fixEntity.remove();

    const notFound = await FixEntity.findById(fixEntityFixtures[0].id);
    expect(notFound).to.equal(null);
  });
});
