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
import { sanitizeTimestamps } from '../../../src/v2/util/util.js';

use(chaiAsPromised);

function checkSiteCompetitor(siteCompetitor) {
  expect(siteCompetitor).to.be.an('object');
  expect(siteCompetitor.getId()).to.be.a('string');
  expect(siteCompetitor.getBaseURL()).to.be.a('string');
  expect(siteCompetitor.getSiteId()).to.be.a('string');
  expect(siteCompetitor.getCreatedAt()).to.be.a('string');
  expect(siteCompetitor.getUpdatedAt()).to.be.a('string');
}

describe('SiteCompetitor IT', async () => {
  let sampleData;
  let SiteCompetitor;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SiteCompetitor = dataAccess.SiteCompetitor;
  });

  it('finds one site competitor by site competitor id', async () => {
    const sampleSiteCompetitor = sampleData.siteCompetitors[3];

    const siteCompetitor = await SiteCompetitor.findById(sampleSiteCompetitor.getId());

    checkSiteCompetitor(siteCompetitor);
    expect(siteCompetitor.getId()).to.equal(sampleSiteCompetitor.getId());
    expect(siteCompetitor.getBaseURL()).to.equal(sampleSiteCompetitor.getBaseURL());
    expect(siteCompetitor.getSiteId()).to.equal(sampleSiteCompetitor.getSiteId());

    expect(
      sanitizeTimestamps(siteCompetitor.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleSiteCompetitor.toJSON()),
    );
  });

  it('returns null when site competitor is not found by site competitor id', async () => {
    const siteCompetitor = await SiteCompetitor.findById('550e8400-e29b-41d4-a716-446655440037');

    expect(siteCompetitor).to.be.null;
  });

  it('adds a new site competitor', async () => {
    const data = {
      siteCompetitorId: '550e8400-e29b-41d4-a716-446655440037',
      siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
      baseURL: 'https://competitor_test.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const siteCompetitor = await SiteCompetitor.create(data);

    checkSiteCompetitor(siteCompetitor);

    expect(siteCompetitor.getId()).to.equal(data.siteCompetitorId);
    expect(siteCompetitor.getSiteId()).to.equal(data.siteId);
    expect(siteCompetitor.getBaseURL()).to.equal(data.baseURL);
  });

  it('updates a site competitor', async () => {
    const sampleSiteCompetitor = sampleData.siteCompetitors[0];
    const updates = {
      siteId: 'b1ec63c4-87de-4500-bbc9-276039e4bc10',
      updatedBy: 'some-user',
    };

    const siteCompetitor = await SiteCompetitor.findById(sampleSiteCompetitor.getId());

    siteCompetitor.setSiteId(updates.siteId);
    siteCompetitor.setUpdatedBy(updates.updatedBy);

    await siteCompetitor.save();

    checkSiteCompetitor(siteCompetitor);

    expect(siteCompetitor.getSiteId()).to.equal(updates.siteId);
    expect(siteCompetitor.getUpdatedBy()).to.equal(updates.updatedBy);
  });

  it('finds all site competitors by site id', async () => {
    const site = sampleData.sites[1];
    const siteCompetitors = await SiteCompetitor.allBySiteId(site.getId());
    expect(siteCompetitors).to.be.an('array');
    expect(siteCompetitors.length).to.equal(9);
    siteCompetitors.forEach((siteCompetitor) => {
      expect(siteCompetitor.getSiteId()).to.equal(site.getId());
      checkSiteCompetitor(siteCompetitor);
    });
  });
  it('finds a site competitors by base url', async () => {
    const siteCompetitor = await SiteCompetitor.findByBaseURL('https://competitor3.com');
    checkSiteCompetitor(siteCompetitor);
    expect(siteCompetitor.getBaseURL()).to.equal('https://competitor3.com');
  });
});
