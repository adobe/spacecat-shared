/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { expect } from 'chai';
import { getDataAccess } from './util/db.js';

// TODO WIP fix errors and remove skip and run after migrate_v2.sh has finished running
describe.skip('Migration Tests', () => {
  let migratedDataAccess;
  let originalDataAccess;
  const originalCounts = {};
  const entities = ['Site', 'Organization', 'SiteCandidate', 'SiteTopPage', 'Experiment', 'Configuration'];

  before(async () => {
    // Get original counts
    migratedDataAccess = await getDataAccess();
    originalDataAccess = await getDataAccess({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });
    try {
      const sites = await originalDataAccess.getSites();
      originalCounts.Site = sites.length;
      const organizations = await originalDataAccess.getOrganizations();
      originalCounts.Organization = organizations.length;
      const siteCandidates = await originalDataAccess.getSiteCandidates();
      originalCounts.SiteCandidate = siteCandidates.length;
      const topPages = await originalDataAccess.getTopPages();
      originalCounts.SiteTopPage = topPages.length;
      const experiments = await originalDataAccess.getExperiments();
      originalCounts.Experiment = experiments.length;
      const configurations = await originalDataAccess.getConfigurations();
      originalCounts.Configuration = configurations.length;
    } catch (error) {
      console.log('Error getting original counts', error.message);
    }
  });

  entities.forEach((entity) => {
    it(`should have the same number of ${entity} entities after migration`, async () => {
      const migratedCount = (await migratedDataAccess[entity].all()).length;
      expect(migratedCount).to.equal(originalCounts[entity]);
    }).timeout(300000);

    it(`should correctly retrieve ${entity} by ID after migration`, async () => {
      const allEntities = await migratedDataAccess[entity].all();
      const randomEntity = allEntities[Math.floor(Math.random() * allEntities.length)];
      const retrievedEntity = await migratedDataAccess[entity].findById(randomEntity.getId());
      expect(retrievedEntity).to.deep.equal(randomEntity);
    }).timeout(300000);
  });

  it('should maintain relationships between entities after migration', async () => {
    const sites = (await migratedDataAccess.Site.all());
    for (const site of sites) {
      // eslint-disable-next-line no-await-in-loop
      const siteCandidates = await site.getSiteCandidates();
      for (const siteCandidate of siteCandidates) {
        // eslint-disable-next-line no-await-in-loop
        const siteCandidateSite = await siteCandidate.getSite();
        expect(siteCandidateSite).to.deep.equal(site);
      }
      // eslint-disable-next-line no-await-in-loop
      const organizationId = await site.getOrganizationId();
      if (organizationId !== 'default') {
        // eslint-disable-next-line no-await-in-loop
        const organization = await migratedDataAccess.Organization.findById(organizationId);
        expect(organization).to.not.be.null;
        expect(organization.getId()).to.equal(organizationId);
      }
    }
  }).timeout(300000);

  xit('should correctly update an entity after migration', async () => {
    const site = (await migratedDataAccess.Site.getAll())[0];
    const originalName = site.getName();
    const newName = 'Updated Site Name';

    site.setName(newName);
    await site.save();

    const updatedSite = await migratedDataAccess.Site.findById(site.getId());
    expect(updatedSite.getName()).to.equal(newName);

    // Revert the change
    site.setName(originalName);
    await site.save();
  });

  xit('should correctly create and delete an entity after migration', async () => {
    const newSite = await migratedDataAccess.Site.create({
      baseURL: 'https://example.com',
      organizationId: (await migratedDataAccess.Organization.getAll())[0].getId(),
      // Add other required fields
    });

    const retrievedSite = await migratedDataAccess.Site.findById(newSite.getId());
    expect(retrievedSite).to.deep.equal(newSite);

    await newSite.remove();

    const deletedSite = await migratedDataAccess.Site.findById(newSite.getId());
    expect(deletedSite).to.be.null;
  });
});
