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

describe('TrialUser IT', async () => {
  let sampleData;
  let TrialUser;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    TrialUser = dataAccess.TrialUser;
  });

  it('gets all trial users', async () => {
    const trialUsers = await TrialUser.all();
    trialUsers.reverse();

    expect(trialUsers).to.be.an('array');
    expect(trialUsers.length).to.equal(sampleData.trialUsers.length);
    for (let i = 0; i < trialUsers.length; i += 1) {
      const trialUser = sanitizeTimestamps(trialUsers[i].toJSON());
      const sampleTrialUser = sanitizeTimestamps(sampleData.trialUsers[i].toJSON());

      expect(trialUser).to.eql(sampleTrialUser);
    }
  });

  it('gets a trial user by id', async () => {
    const sampleTrialUser = sampleData.trialUsers[0];
    const trialUser = await TrialUser.findById(sampleTrialUser.getId());

    expect(trialUser).to.be.an('object');
    expect(
      sanitizeTimestamps(trialUser.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleTrialUser.toJSON()),
    );
  });

  it('gets a trial user by email id', async () => {
    const sampleTrialUser = sampleData.trialUsers[0];
    const emailId = sampleTrialUser.getEmailId();

    const trialUser = await TrialUser.findByEmailId(emailId);

    expect(trialUser).to.be.an('object');
    expect(trialUser.getEmailId()).to.equal(emailId);
    expect(
      sanitizeTimestamps(trialUser.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleTrialUser.toJSON()),
    );
  });

  it('gets all trial users by organization id', async () => {
    const sampleTrialUser = sampleData.trialUsers[0];
    const organizationId = sampleTrialUser.getOrganizationId();

    const trialUsers = await TrialUser.allByOrganizationId(organizationId);

    expect(trialUsers).to.be.an('array');
    expect(trialUsers.length).to.be.greaterThan(0);

    for (const trialUser of trialUsers) {
      expect(trialUser.getOrganizationId()).to.equal(organizationId);
    }
  });

  it('adds a new trial user', async () => {
    const data = {
      organizationId: sampleData.organizations[0].getId(),
      emailId: 'newuser@example.com',
      externalUserId: 'ext-user-new',
      status: 'INVITED',
      firstName: 'Jane',
      lastName: 'Smith',
      metadata: {
        signupSource: 'google',
        preferences: {
          notifications: false,
        },
      },
      updatedBy: 'system',
    };

    const trialUser = await TrialUser.create(data);

    expect(trialUser).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('TrialUser', trialUser.toJSON()),
    ).to.eql(data);
  });

  it('updates a trial user status', async () => {
    const trialUser = await TrialUser.findById(sampleData.trialUsers[0].getId());
    const newStatus = 'BLOCKED';

    const expectedTrialUser = {
      ...trialUser.toJSON(),
      status: newStatus,
    };

    trialUser.setStatus(newStatus);

    await trialUser.save();

    const updatedTrialUser = await TrialUser.findById(trialUser.getId());

    expect(updatedTrialUser.getId()).to.equal(trialUser.getId());
    expect(updatedTrialUser.record.createdAt).to.equal(trialUser.record.createdAt);
    expect(
      sanitizeIdAndAuditFields('TrialUser', updatedTrialUser.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('TrialUser', expectedTrialUser),
    );
  });

  it('updates a trial user external user id and email id', async () => {
    const trialUser = await TrialUser.findById(sampleData.trialUsers[0].getId());
    const newExternalUserId = 'ext-user-updated';
    const newEmailId = 'updated@example.com';

    const expectedTrialUser = {
      ...trialUser.toJSON(),
      externalUserId: newExternalUserId,
      emailId: newEmailId,
    };

    trialUser.setExternalUserId(newExternalUserId);
    trialUser.setEmailId(newEmailId);

    await trialUser.save();

    const updatedTrialUser = await TrialUser.findById(trialUser.getId());

    expect(updatedTrialUser.getId()).to.equal(trialUser.getId());
    expect(updatedTrialUser.record.createdAt).to.equal(trialUser.record.createdAt);
    expect(
      sanitizeIdAndAuditFields('TrialUser', updatedTrialUser.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('TrialUser', expectedTrialUser),
    );
  });

  it('removes a trial user', async () => {
    const trialUser = await TrialUser.findById(sampleData.trialUsers[0].getId());

    await trialUser.remove();

    const notFound = await TrialUser.findById(sampleData.trialUsers[0].getId());
    expect(notFound).to.be.null;
  });
});
