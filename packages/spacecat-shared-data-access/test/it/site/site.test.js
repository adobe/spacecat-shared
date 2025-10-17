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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import siteFixtures from '../../fixtures/sites.fixture.js';
import { sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { Config } from '../../../src/models/site/config.js';

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
  expect(site.getIsSandbox()).to.be.a('boolean');
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

      delete organization.record.config;
      delete sampleData.organizations[0].record.config;

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

  it('returns true when a site exists by id', async () => {
    const exists = await Site.existsById(sampleData.sites[0].getId());
    expect(exists).to.be.true;
  });

  it('returns false when a site does not exist by id', async () => {
    const exists = await Site.existsById('adddd03e-bde1-4340-88ef-904070457745');
    expect(exists).to.be.false;
  });

  it('batch gets multiple sites by keys', async () => {
    const keys = [
      { siteId: sampleData.sites[0].getId() },
      { siteId: sampleData.sites[1].getId() },
      { siteId: sampleData.sites[2].getId() },
    ];

    const result = await Site.batchGetByKeys(keys);

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(3);
    expect(result.unprocessed).to.be.an('array');
    expect(result.unprocessed.length).to.equal(0);

    // Verify each site is returned correctly
    const returnedIds = result.data.map((site) => site.getId()).sort();
    const expectedIds = [
      sampleData.sites[0].getId(),
      sampleData.sites[1].getId(),
      sampleData.sites[2].getId(),
    ].sort();

    expect(returnedIds).to.deep.equal(expectedIds);

    // Verify site objects are fully populated
    for (let i = 0; i < result.data.length; i += 1) {
      await checkSite(result.data[i]);
    }
  });

  it('batch gets sites with attributes option', async () => {
    const keys = [
      { siteId: sampleData.sites[0].getId() },
      { siteId: sampleData.sites[1].getId() },
    ];

    // Request only specific attributes
    const result = await Site.batchGetByKeys(keys, {
      attributes: ['siteId', 'baseURL', 'deliveryType'],
    });

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(2);
    expect(result.unprocessed).to.be.an('array');
    expect(result.unprocessed.length).to.equal(0);

    // Verify sites are returned with only requested attributes
    result.data.forEach((site) => {
      const json = site.toJSON();

      // Verify requested attributes ARE present
      expect(json.siteId).to.be.a('string');
      expect(json.baseURL).to.be.a('string');
      expect(json.deliveryType).to.be.a('string');

      // Verify other attributes are NOT present
      expect(json.gitHubURL).to.be.undefined;
      expect(json.name).to.be.undefined;
      expect(json.organizationId).to.be.undefined;
      expect(json.isLive).to.be.undefined;
      expect(json.hlxConfig).to.be.undefined;
      expect(json.createdAt).to.be.undefined;
      expect(json.updatedAt).to.be.undefined;

      // Verify we only have the exact number of attributes we requested
      // (plus internal ElectroDB attributes that start with __)
      const userAttributes = Object.keys(json).filter((key) => !key.startsWith('__'));
      expect(userAttributes.length).to.equal(3);
    });
  });

  it('batch gets sites handles non-existent keys', async () => {
    const keys = [
      { siteId: sampleData.sites[0].getId() },
      { siteId: 'non-existent-id-12345' },
      { siteId: sampleData.sites[1].getId() },
    ];

    const result = await Site.batchGetByKeys(keys);

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    // Should return only the 2 existing sites
    expect(result.data.length).to.equal(2);

    const returnedIds = result.data.map((site) => site.getId()).sort();
    const expectedIds = [
      sampleData.sites[0].getId(),
      sampleData.sites[1].getId(),
    ].sort();

    expect(returnedIds).to.deep.equal(expectedIds);
  });

  it('gets all audits for a site', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audits = await site.getAudits();

    expect(audits).to.be.an('array');
    expect(audits.length).to.equal(10);

    for (let i = 0; i < audits.length; i += 1) {
      const audit = audits[i];

      expect(audit.getId()).to.be.a('string');
      expect(audit.getSiteId()).to.equal(site.getId());
    }
  });

  it('gets all audits for a site by type', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audits = await site.getAuditsByAuditType('cwv');

    expect(audits).to.be.an('array');
    expect(audits.length).to.equal(5);

    for (let i = 0; i < audits.length; i += 1) {
      const audit = audits[i];

      expect(audit.getId()).to.be.a('string');
      expect(audit.getSiteId()).to.equal(site.getId());
      expect(audit.getAuditType()).to.equal('cwv');
    }
  });

  it('gets all audits for a site by type and auditAt', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audits = await site.getAuditsByAuditTypeAndAuditedAt('cwv', '2024-12-03T08:00:55.754Z');

    expect(audits).to.be.an('array');
    expect(audits.length).to.equal(5);

    for (let i = 0; i < audits.length; i += 1) {
      const audit = audits[i];

      expect(audit.getId()).to.be.a('string');
      expect(audit.getSiteId()).to.equal(site.getId());
      expect(audit.getAuditType()).to.equal('cwv');
      expect(audit.getAuditedAt()).to.equal('2024-12-03T08:00:55.754Z');
    }
  });

  it('gets latest audit for a site', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audit = await site.getLatestAudit();

    expect(audit.getId()).to.be.a('string');
    expect(audit.getSiteId()).to.equal(site.getId());
  });

  it('gets latest audit for a site by type', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audit = await site.getLatestAuditByAuditType('cwv');

    expect(audit.getId()).to.be.a('string');
    expect(audit.getSiteId()).to.equal(site.getId());
    expect(audit.getAuditType()).to.equal('cwv');
  });

  it('returns null for latest audit for a site by type if not found', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audit = await site.getLatestAuditByAuditType('does not exist');

    expect(audit).to.be.null;
  });

  it('gets all latest audits for a site', async () => {
    const site = await Site.findById(sampleData.sites[1].getId());
    const audits = await site.getLatestAudits();

    expect(audits).to.be.an('array');
    expect(audits.length).to.equal(2);

    for (let i = 0; i < audits.length; i += 1) {
      const audit = audits[i];

      expect(audit.getId()).to.be.a('string');
      expect(audit.getSiteId()).to.equal(site.getId());
    }
  });

  it('gets all sites with latest audit by type', async () => {
    const sites = await Site.allWithLatestAudit('cwv');

    expect(sites).to.be.an('array');
    expect(sites.length).to.equal(10);

    const siteWithoutAudits = await Site.findById('5d6d4439-6659-46c2-b646-92d110fa5a52');
    await checkSite(siteWithoutAudits);
    await expect(siteWithoutAudits.getLatestAuditByAuditType('cwv')).to.eventually.be.null;

    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-loop-func
      const site = sites[i];
      if (site.getId() === siteWithoutAudits.getId()) {
        // eslint-disable-next-line no-continue
        continue;
      }

      await checkSite(site);

      const audit = await site.getLatestAuditByAuditType('cwv');

      expect(audit).to.be.an('object');
      expect(audit.getSiteId()).to.equal(site.getId());
      expect(audit.getAuditType()).to.equal('cwv');

      const nonExistingAudit = await site.getLatestAuditByAuditType('does not exist');

      expect(nonExistingAudit).to.be.null;
    }
  });

  it('finds site by preview URL using deliveryConfig', async () => {
    // Create a test site with specific RSO configuration
    const site = await Site.create({
      baseURL: 'https://preview-test.com',
      name: 'preview-test-site',
      organizationId: sampleData.organizations[0].getId(),
      hlxConfig: {
        rso: {
          ref: 'feature-branch',
          site: 'my-site',
          owner: 'mycompany',
        },
      },
      deliveryType: 'aem_edge',
      authoringType: 'cs',
      deliveryConfig: {
        programId: '123',
        environmentId: '456',
        authorURL: 'https://author.preview-test.com',
      },
      isLive: true,
    });

    const previewURL = 'https://author-p123-e456.adobeaemcloud.com/some/path';
    const foundSite = await Site.findByPreviewURL(previewURL);
    expect(foundSite).to.be.an('object');
    expect(foundSite.getId()).to.equal(site.getId());
    expect(foundSite.getBaseURL()).to.equal('https://preview-test.com');

    const nonExistentURL = 'https://non-existent--test--adobe.hlx.page/';
    const notFound = await Site.findByPreviewURL(nonExistentURL);
    expect(notFound).to.be.null;

    // Clean up
    await site.remove();
  });

  it('adds a new site', async () => {
    const newSiteData = {
      baseURL: 'https://newexample.com',
      gitHubURL: 'https://github.com/some-org/test-repo',
      name: 'new-site',
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
      isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      isSandbox: false,
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
    expect(newSite.getName()).to.equal(newSiteData.name);
  });

  it('updates a site', async () => {
    const site = await Site.findById(sampleData.sites[0].getId());
    const updates = {
      baseURL: 'https://updated-example.com',
      deliveryType: 'aem_cs',
      gitHubURL: 'https://updated-github.com',
      isLive: false,
      isSandbox: true,
      organizationId: sampleData.organizations[1].getId(),
      name: 'updated-site',
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
    site.setName(updates.name);
    site.setDeliveryType(updates.deliveryType);
    site.setGitHubURL(updates.gitHubURL);
    site.setHlxConfig(updates.hlxConfig);
    site.setIsLive(updates.isLive);
    site.setIsSandbox(updates.isSandbox);
    site.setOrganizationId(updates.organizationId);

    await site.save();

    const updatedSite = await Site.findById(site.getId());

    await checkSite(updatedSite);

    expect(updatedSite.getBaseURL()).to.equal(updates.baseURL);
    expect(updatedSite.getDeliveryType()).to.equal(updates.deliveryType);
    expect(updatedSite.getGitHubURL()).to.equal(updates.gitHubURL);
    expect(updatedSite.getIsLive()).to.equal(updates.isLive);
    expect(updatedSite.getIsSandbox()).to.equal(updates.isSandbox);
    expect(updatedSite.getOrganizationId()).to.equal(updates.organizationId);
    expect(updatedSite.getName()).to.equal(updates.name);
  });

  it('reads config of a site', async () => {
    const { config: configFixture } = siteFixtures[0];
    configFixture.imports[0].enabled = true; // set by joi schema default
    const site = await Site.findById('5d6d4439-6659-46c2-b646-92d110fa5a52');
    const config = site.getConfig();
    expect(config).to.be.an('object');
    expect(config.state).to.deep.equals(configFixture);
  });

  it('removes a site', async () => {
    const site = await Site.findById(sampleData.sites[0].getId());

    await site.remove();

    const notFound = await Site.findById(sampleData.sites[0].getId());
    expect(notFound).to.be.null;
  });

  it('gets latest metrics for a site', async () => {
    const site = await Site.findById('5d6d4439-6659-46c2-b646-92d110fa5a52');
    const latestMetrics = site.getConfig().getLatestMetrics('latest-metrics');

    expect(latestMetrics).to.be.an('object');
    expect(latestMetrics.pageViewsChange).to.equal(10);
    expect(latestMetrics.ctrChange).to.equal(5);
    expect(latestMetrics.projectedTrafficValue).to.equal(1000);
  });

  it('updates latest metrics for a site', async () => {
    const site = await Site.findById('5d6d4439-6659-46c2-b646-92d110fa5a52');
    const config = site.getConfig();

    const latestMetrics = {
      pageViewsChange: 20,
      ctrChange: 10,
      projectedTrafficValue: 2000,
    };

    config.updateLatestMetrics('latest-metrics', latestMetrics);

    const updatedMetrics = config.getLatestMetrics('latest-metrics');

    expect(updatedMetrics.pageViewsChange).to.equal(20);
    expect(updatedMetrics.ctrChange).to.equal(10);
    expect(updatedMetrics.projectedTrafficValue).to.equal(2000);
  });

  describe('Site Import Configuration', () => {
    it('creates a site with import configuration', async () => {
      const newSiteData = {
        baseURL: 'https://import-example.com',
        gitHubURL: 'https://github.com/some-org/import-test-repo',
        name: 'import-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
        config: {
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
            pageUrl: 'https://import-example.com/blog',
          }],
        },
      };

      const site = await Site.create(newSiteData);
      const config = site.getConfig();

      expect(config.getImports()).to.deep.equal(newSiteData.config.imports);
      expect(config.isImportEnabled('organic-keywords')).to.be.true;
      expect(config.getImportConfig('organic-keywords')).to.deep.equal(newSiteData.config.imports[0]);
    });

    it('updates site import configuration', async () => {
      // First create a site with initial import config
      const site = await Site.create({
        baseURL: 'https://import-update-example.com',
        gitHubURL: 'https://github.com/some-org/import-update-test-repo',
        name: 'import-update-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
        config: {
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
          }],
        },
      });

      // Update import configuration
      const config = site.getConfig();
      config.enableImport('organic-traffic', {
        sources: ['google'],
      });
      config.disableImport('organic-keywords');

      site.setConfig(Config.toDynamoItem(config));

      // Save the site with updated config
      await site.save();

      // Fetch the site again and verify the changes
      const updatedSite = await Site.findById(site.getId());
      const updatedConfig = updatedSite.getConfig();

      expect(updatedConfig.getImports()).to.have.length(2);
      expect(updatedConfig.isImportEnabled('organic-keywords')).to.be.false;
      expect(updatedConfig.isImportEnabled('organic-traffic')).to.be.true;
      expect(updatedConfig.getImportConfig('organic-traffic')).to.deep.equal({
        type: 'organic-traffic',
        destinations: ['default'],
        sources: ['google'],
        enabled: true,
      });
    });

    it('handles multiple import types with different configurations', async () => {
      const site = await Site.create({
        baseURL: 'https://multi-import-example.com',
        gitHubURL: 'https://github.com/some-org/multi-import-test-repo',
        name: 'multi-import-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      });

      const config = site.getConfig();

      // Enable multiple import types with different configs
      config.enableImport('organic-keywords', {
        pageUrl: 'https://multi-import-example.com/blog',
      });
      config.enableImport('organic-traffic', {
        sources: ['google'],
      });
      config.enableImport('top-pages', {
        geo: 'us',
      });

      site.setConfig(Config.toDynamoItem(config));

      await site.save();

      const updatedSite = await Site.findById(site.getId());
      const updatedConfig = updatedSite.getConfig();
      const imports = updatedConfig.getImports();

      expect(imports).to.have.length(3);
      expect(imports.every((imp) => imp.enabled)).to.be.true;
      expect(updatedConfig.getImportConfig('organic-keywords').pageUrl)
        .to.equal('https://multi-import-example.com/blog');
      expect(updatedConfig.getImportConfig('organic-traffic').sources)
        .to.deep.equal(['google']);
      expect(updatedConfig.getImportConfig('top-pages').geo)
        .to.equal('us');
    });
  });

  describe('Site Sandbox Configuration', () => {
    it('creates a site with default isSandbox value (false)', async () => {
      const newSiteData = {
        baseURL: 'https://default-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/default-sandbox-test-repo',
        name: 'default-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);

      expect(site.getIsSandbox()).to.be.false;

      // Clean up
      await site.remove();
    });

    it('creates a site with isSandbox set to true', async () => {
      const newSiteData = {
        baseURL: 'https://sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/sandbox-test-repo',
        name: 'sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isSandbox: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);

      expect(site.getIsSandbox()).to.be.true;

      // Clean up
      await site.remove();
    });

    it('creates a site with isSandbox set to false explicitly', async () => {
      const newSiteData = {
        baseURL: 'https://non-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/non-sandbox-test-repo',
        name: 'non-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isSandbox: false,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);

      expect(site.getIsSandbox()).to.be.false;

      // Clean up
      await site.remove();
    });

    it('updates isSandbox value from false to true', async () => {
      // Create a site with isSandbox false
      const newSiteData = {
        baseURL: 'https://update-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/update-sandbox-test-repo',
        name: 'update-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isSandbox: false,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);
      expect(site.getIsSandbox()).to.be.false;

      // Update isSandbox to true
      site.setIsSandbox(true);
      await site.save();

      // Fetch the updated site and verify the change
      const updatedSite = await Site.findById(site.getId());
      expect(updatedSite.getIsSandbox()).to.be.true;

      // Clean up
      await updatedSite.remove();
    });

    it('updates isSandbox value from true to false', async () => {
      // Create a site with isSandbox true
      const newSiteData = {
        baseURL: 'https://toggle-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/toggle-sandbox-test-repo',
        name: 'toggle-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isSandbox: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);
      expect(site.getIsSandbox()).to.be.true;

      // Update isSandbox to false
      site.setIsSandbox(false);
      await site.save();

      // Fetch the updated site and verify the change
      const updatedSite = await Site.findById(site.getId());
      expect(updatedSite.getIsSandbox()).to.be.false;

      // Clean up
      await updatedSite.remove();
    });

    it('verifies isSandbox getter and setter methods work correctly', async () => {
      const newSiteData = {
        baseURL: 'https://getter-setter-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/getter-setter-sandbox-test-repo',
        name: 'getter-setter-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);

      // Test default value
      expect(site.getIsSandbox()).to.be.false;

      // Test setter returns the site object for chaining
      const returnedSite = site.setIsSandbox(true);
      expect(returnedSite).to.equal(site);
      expect(site.getIsSandbox()).to.be.true;

      // Test setting back to false
      site.setIsSandbox(false);
      expect(site.getIsSandbox()).to.be.false;

      // Clean up
      await site.remove();
    });

    it('handles isSandbox in combination with other site properties', async () => {
      const newSiteData = {
        baseURL: 'https://combined-sandbox-example.com',
        gitHubURL: 'https://github.com/some-org/combined-sandbox-test-repo',
        name: 'combined-sandbox-test-site',
        organizationId: sampleData.organizations[0].getId(),
        isLive: true,
        isSandbox: true,
        deliveryType: 'aem_edge',
        authoringType: 'cs',
        hlxConfig: {
          rso: {
            ref: 'main',
            site: 'test-site',
            owner: 'test-owner',
          },
        },
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(newSiteData);

      // Verify all properties including isSandbox
      expect(site.getIsSandbox()).to.be.true;
      expect(site.getIsLive()).to.be.true;
      expect(site.getDeliveryType()).to.equal('aem_edge');
      expect(site.getAuthoringType()).to.equal('cs');
      expect(site.getBaseURL()).to.equal('https://combined-sandbox-example.com');

      // Update multiple properties including isSandbox
      site.setIsSandbox(false);
      site.setIsLive(false);
      site.setDeliveryType('aem_cs');

      await site.save();

      // Verify updates were saved correctly
      const updatedSite = await Site.findById(site.getId());
      expect(updatedSite.getIsSandbox()).to.be.false;
      expect(updatedSite.getIsLive()).to.be.false;
      expect(updatedSite.getDeliveryType()).to.equal('aem_cs');

      // Clean up
      await updatedSite.remove();
    });
  });
  describe('Project-Site relationship', () => {
    it('gets sites by project id', async () => {
      const projectId = sampleData.projects[0].getId();
      const sites = await Site.allByProjectId(projectId);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(projectId);
      }
    });

    it('gets sites by project name', async () => {
      const projectName = sampleData.projects[0].getProjectName();
      const sites = await Site.allByProjectName(projectName);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());
      }
    });

    it('gets sites by organization id and project id', async () => {
      const organizationId = sampleData.organizations[0].getId();
      const projectId = sampleData.projects[0].getId();
      const sites = await Site.allByOrganizationIdAndProjectId(organizationId, projectId);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(projectId);
        expect(site.getOrganizationId()).to.equal(organizationId);
      }
    });

    it('gets sites by organization id and project name', async () => {
      const organizationId = sampleData.organizations[0].getId();
      const projectName = sampleData.projects[0].getProjectName();
      const sites = await Site.allByOrganizationIdAndProjectName(organizationId, projectName);

      expect(sites).to.be.an('array');

      for (let i = 0; i < sites.length; i += 1) {
        const site = sites[i];
        expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());
        expect(site.getOrganizationId()).to.equal(organizationId);
      }
    });
  });

  describe('Site localization fields', () => {
    it('creates a site with localization data', async () => {
      const siteData = {
        baseURL: 'https://localized-example.com',
        name: 'localized-site',
        organizationId: sampleData.organizations[0].getId(),
        projectId: sampleData.projects[0].getId(),
        isPrimaryLocale: false,
        language: 'en',
        region: 'US',
        isLive: true,
        isLiveToggledAt: '2024-12-06T08:35:24.125Z',
      };

      const site = await Site.create(siteData);

      expect(site.getIsPrimaryLocale()).to.equal(false);
      expect(site.getLanguage()).to.equal('en');
      expect(site.getRegion()).to.equal('US');
      expect(site.getProjectId()).to.equal(sampleData.projects[0].getId());

      // Clean up
      await site.remove();
    });

    it('updates site localization data', async () => {
      const site = await Site.findById(sampleData.sites[1].getId());

      site.setIsPrimaryLocale(true);
      site.setLanguage('fr');
      site.setRegion('FR');
      site.setProjectId(sampleData.projects[0].getId());

      await site.save();

      const updatedSite = await Site.findById(site.getId());

      expect(updatedSite.getIsPrimaryLocale()).to.equal(true);
      expect(updatedSite.getLanguage()).to.equal('fr');
      expect(updatedSite.getRegion()).to.equal('FR');
      expect(updatedSite.getProjectId()).to.equal(sampleData.projects[0].getId());
    });
  });
});
