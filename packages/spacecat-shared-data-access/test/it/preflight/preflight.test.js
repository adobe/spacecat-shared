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
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { IT_HOOK_TIMEOUT } from '../util/util.js';

use(chaiAsPromised);

describe('Preflight IT', async () => {
  let sampleData;
  let Preflight;
  let AsyncJob;

  before(async function () {
    this.timeout(IT_HOOK_TIMEOUT);
    sampleData = await seedDatabase();
    const dataAccess = getDataAccess();
    Preflight = dataAccess.Preflight;
    AsyncJob = dataAccess.AsyncJob;
  });

  it('finds a preflight by id', async () => {
    const sample = sampleData.preflights[0];
    const preflight = await Preflight.findById(sample.getId());
    expect(preflight).to.be.an('object');
    expect(preflight.getId()).to.equal(sample.getId());
    expect(preflight.getUrl()).to.equal(sample.getUrl());
    expect(preflight.getStatus()).to.equal(sample.getStatus());
    expect(preflight.getCreatedAt()).to.be.a('string');
    expect(preflight.getUpdatedAt()).to.be.a('string');
  });

  it('creates a preflight defaulting to IN_PROGRESS status', async () => {
    const asyncJob = await AsyncJob.create({ status: 'IN_PROGRESS' });
    const preflight = await Preflight.create({
      siteId: sampleData.sites[0].getId(),
      asyncJobId: asyncJob.getId(),
      url: 'https://www.example.com/it-create-test',
      createdBy: { email: 'it@example.com', displayName: 'IT User' },
    });
    expect(preflight.getStatus()).to.equal('IN_PROGRESS');
    expect(preflight.getUrl()).to.equal('https://www.example.com/it-create-test');
    expect(preflight.getSiteId()).to.equal(sampleData.sites[0].getId());
  });

  it('returns all preflights for a site via allBySiteId', async () => {
    const site = sampleData.sites[0];
    const preflights = await Preflight.allBySiteId(site.getId());
    expect(preflights).to.be.an('array');
    expect(preflights.length).to.be.at.least(2);
    preflights.forEach((p) => expect(p.getSiteId()).to.equal(site.getId()));
  });

  it('filters preflights by url via allBySiteIdAndUrl', async () => {
    const site = sampleData.sites[0];
    const url = 'https://www.example.com/page1';
    const preflights = await Preflight.allBySiteIdAndUrl(site.getId(), url);
    expect(preflights).to.be.an('array');
    expect(preflights.length).to.equal(1);
    expect(preflights[0].getUrl()).to.equal(url);
  });

  it('returns all preflights when no url filter is given', async () => {
    const site = sampleData.sites[0];
    const preflights = await Preflight.allBySiteIdAndUrl(site.getId());
    expect(preflights).to.be.an('array');
    expect(preflights.length).to.be.at.least(2);
  });

  it('finds a preflight by asyncJobId', async () => {
    const sample = sampleData.preflights[0];
    const preflight = await Preflight.findByAsyncJobId(sample.getAsyncJobId());
    expect(preflight).to.not.be.null;
    expect(preflight.getId()).to.equal(sample.getId());
  });

  it('does not expose asyncJobId in toJSON()', async () => {
    const sample = sampleData.preflights[0];
    const preflight = await Preflight.findById(sample.getId());
    expect(preflight.toJSON()).to.not.have.property('asyncJobId');
  });

  it('cascade-deletes when the backing AsyncJob is removed', async () => {
    const asyncJob = await AsyncJob.create({ status: 'IN_PROGRESS' });
    const preflight = await Preflight.create({
      siteId: sampleData.sites[0].getId(),
      asyncJobId: asyncJob.getId(),
      url: 'https://www.example.com/cascade-test',
      createdBy: { email: 'cascade@example.com', displayName: 'Cascade Test' },
    });
    const preflightId = preflight.getId();

    await asyncJob.remove();

    const gone = await Preflight.findById(preflightId);
    expect(gone).to.be.null;
  });
});
