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
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('AccessGrantLog IT', async () => {
  let sampleData;
  let AccessGrantLog;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    AccessGrantLog = dataAccess.AccessGrantLog;
  });

  it('gets an access grant log by id', async () => {
    const sample = sampleData.accessGrantLogs[0];
    const log = await AccessGrantLog.findById(sample.getId());

    expect(log).to.be.an('object');
    expect(
      sanitizeTimestamps(log.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sample.toJSON()),
    );
  });

  it('gets all logs by organization id', async () => {
    const sample = sampleData.accessGrantLogs[0];
    const organizationId = sample.getOrganizationId();

    const logs = await AccessGrantLog.allByOrganizationId(organizationId);

    expect(logs).to.be.an('array');
    expect(logs.length).to.be.greaterThan(0);

    for (const log of logs) {
      expect(log.getOrganizationId()).to.equal(organizationId);
    }
  });

  it('gets all logs by site id', async () => {
    const sample = sampleData.accessGrantLogs[0];
    const siteId = sample.getSiteId();

    const logs = await AccessGrantLog.allBySiteId(siteId);

    expect(logs).to.be.an('array');
    expect(logs.length).to.be.greaterThan(0);

    for (const log of logs) {
      expect(log.getSiteId()).to.equal(siteId);
    }
  });

  it('creates a new access grant log', async () => {
    const data = {
      siteId: sampleData.sites[0].getId(),
      organizationId: sampleData.organizations[1].getId(),
      targetOrganizationId: sampleData.organizations[0].getId(),
      productCode: 'LLMO',
      action: 'grant',
      role: 'viewer',
      performedBy: 'slack:U99999',
      updatedBy: 'system',
    };

    const log = await AccessGrantLog.create(data);

    expect(log).to.be.an('object');
    expect(log.getSiteId()).to.equal(data.siteId);
    expect(log.getOrganizationId()).to.equal(data.organizationId);
    expect(log.getTargetOrganizationId()).to.equal(data.targetOrganizationId);
    expect(log.getProductCode()).to.equal('LLMO');
    expect(log.getAction()).to.equal('grant');
    expect(log.getRole()).to.equal('viewer');
    expect(log.getPerformedBy()).to.equal('slack:U99999');
  });

  it('does not expose setters on immutable log entry', async () => {
    const log = await AccessGrantLog.findById(sampleData.accessGrantLogs[0].getId());
    expect(log.setRole).to.be.undefined;
    expect(log.setPerformedBy).to.be.undefined;
    expect(log.setAction).to.be.undefined;
  });

  it('rejects save on immutable log entry with DataAccessError', async () => {
    const log = await AccessGrantLog.findById(sampleData.accessGrantLogs[0].getId());

    try {
      await log.save();
      expect.fail('Expected save to throw');
    } catch (err) {
      expect(err).to.be.instanceof(DataAccessError);
      expect(err.cause?.message).to.include('Updates prohibited by schema');
    }
  });

  it('rejects remove on immutable log entry with DataAccessError', async () => {
    const log = await AccessGrantLog.findById(sampleData.accessGrantLogs[0].getId());

    await expect(log.remove()).to.be.rejectedWith(DataAccessError, 'does not allow removal');
  });
});
