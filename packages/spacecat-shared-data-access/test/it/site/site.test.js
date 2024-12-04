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
/* eslint-disable no-console */

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeTimestamps } from '../../../src/v2/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

async function checkSite(site) {
  expect(site).to.be.an('object');
  expect(site.getId()).to.be.a('string');
  expect(site.getBaseURL()).to.be.a('string');
  expect(site.getDeliveryType()).to.be.a('string');
  expect(site.getGitHubURL()).to.be.a('string');
  expect(site.getHlxConfig()).to.be.an('object');
  expect(site.getOrganizationId()).to.be.a('string');
  expect(isIsoDate(site.getCreatedAt())).to.be.true;
  expect(isIsoDate(site.getUpdatedAt())).to.be.true;

  const audits = await site.getAudits();
  expect(audits).to.be.an('array');
  expect(site.getIsLive()).to.be.a('boolean');
  expect(isIsoDate(site.getIsLiveToggledAt())).to.be.true;
}

describe('Site IT', async () => {
  let sampleData;
  let Site;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Site = dataAccess.Site;
  });

  it('gets all sites', async () => {
    let sites = await Site.all();

    expect(sites).to.be.an('array');
    expect(sites.length).to.equal(10);

    sites = sites.sort((a, b) => a.getBaseURL().localeCompare(b.getBaseURL()));

    for (let i = 0; i < sites.length; i += 1) { /* eslint-disable no-await-in-loop */
      await checkSite(sites[i]);
    }
  });

  it('gets all sites to audit (only id attributes returned)', async () => {
    const siteIds = await Site.allSitesToAudit();

    expect(siteIds).to.be.an('array');
    expect(siteIds.length).to.equal(10);

    const ids = sampleData.sites.reverse().map((site) => site.getId());

    expect(siteIds).to.eql(ids);
  });

  it('gets all sites by organization id', async () => {
    const organizationId = sampleData.organizations[0].getId();
    const sites = await Site.allByOrganizationId(organizationId);

    expect(sites).to.be.an('array');
    expect(sites.length).to.equal(4);

    for (let i = 0; i < sites.length; i += 1) { /* eslint-disable no-await-in-loop */
      const site = sites[i];

      await checkSite(site);

      const organization = await site.getOrganization();

      expect(site.getOrganizationId()).to.equal(organizationId);
      expect(organization).to.be.an('object');
      expect(
        sanitizeTimestamps(organization.toJSON()),
      ).to.eql(
        sanitizeTimestamps(sampleData.organizations[0].toJSON()),
      );
    }
  });

  it('gets all sites by delivery type', async () => {
    const deliveryType = 'aem_edge';
    const sites = await Site.allByDeliveryType(deliveryType);

    expect(sites).to.be.an('array');
    expect(sites.length).to.equal(5);

    for (let i = 0; i < sites.length; i += 1) {
      const site = sites[i];
      // eslint-disable-next-line no-await-in-loop
      await checkSite(site);
      expect(site.getDeliveryType()).to.equal(deliveryType);
    }
  });

  it('gets a site by baseURL', async () => {
    const site = await Site.findByBaseURL(sampleData.sites[0].getBaseURL());

    await checkSite(site);

    expect(site.getBaseURL()).to.equal(sampleData.sites[0].getBaseURL());
  });

  it('gets a site by id', async () => {
    const site = await Site.findById(sampleData.sites[0].getId());

    await checkSite(site);

    expect(site.getId()).to.equal(sampleData.sites[0].getId());
  });

  it('adds a new site', async () => {
    const newSiteData = {
      baseURL: 'https://newexample.com',
      gitHubURL: 'https://github.com/some-org/test-repo',
      hlxConfig: {
        cdnProdHost: 'www.another-example.com',
        code: {
          owner: 'another-owner',
          repo: 'another-repo',
          source: {
            type: 'github',
            url: 'https://github.com/another-owner/another-repo',
          },
        },
        content: {
          contentBusId: '1234',
          source: {
            type: 'onedrive',
            url: 'https://another-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/another-site/www',
          },
        },
        hlxVersion: 5,
      },
      organizationId: sampleData.organizations[0].getId(),
      isLive: true,
      isLiveToggledAt: Date.now(),
      audits: [],
      config: {
        handlers: {
          'lhs-mobile': {
            excludedURLs: ['https://example.com/excluded'],
          },
        },
      },
    };

    const newSite = await Site.create(newSiteData);
    await checkSite(newSite);

    expect(newSite.getBaseURL()).to.equal(newSiteData.baseURL);
  });

  it('updates a site', async () => {
    const site = await Site.findById(sampleData.sites[0].getId());
    const updates = {
      baseURL: 'https://updated-example.com',
      deliveryType: 'aem_cs',
      gitHubURL: 'https://updated-github.com',
      isLive: false,
      organizationId: sampleData.organizations[1].getId(),
      hlxConfig: {
        cdnProdHost: 'www.another-example.com',
        code: {
          owner: 'another-owner',
          repo: 'another-repo',
          source: {
            type: 'github',
            url: 'https://github.com/another-owner/another-repo',
          },
        },
        content: {
          contentBusId: '1234',
          source: {
            type: 'onedrive',
            url: 'https://another-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/another-site/www',
          },
        },
        hlxVersion: 5,
      },
    };

    site.setBaseURL(updates.baseURL);
    site.setDeliveryType(updates.deliveryType);
    site.setGitHubURL(updates.gitHubURL);
    site.setHlxConfig(updates.hlxConfig);
    site.setIsLive(updates.isLive);
    site.setOrganizationId(updates.organizationId);

    await site.save();

    const updatedSite = await Site.findById(site.getId());

    await checkSite(updatedSite);

    expect(updatedSite.getBaseURL()).to.equal(updates.baseURL);
    expect(updatedSite.getDeliveryType()).to.equal(updates.deliveryType);
    expect(updatedSite.getGitHubURL()).to.equal(updates.gitHubURL);
    expect(updatedSite.getIsLive()).to.equal(updates.isLive);
    expect(updatedSite.getOrganizationId()).to.equal(updates.organizationId);
  });

  it('removes a site', async () => {
    const site = await Site.findById(sampleData.sites[0].getId());

    await site.remove();

    const notFound = await Site.findById(sampleData.sites[0].getId());
    expect(notFound).to.be.null;

    // todo: add test for removing a site with associated entities once implemented
  });
});
