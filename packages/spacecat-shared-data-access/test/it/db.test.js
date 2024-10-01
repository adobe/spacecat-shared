/*
 * Copyright 2023 Adobe. All rights reserved.
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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spawn } from 'dynamo-db-local';
import Joi from 'joi';

import { isIsoDate } from '@adobe/spacecat-shared-utils';
import { v4 as uuidv4 } from 'uuid';
import { sleep } from '../unit/util.js';
import { createDataAccess } from '../../src/service/index.js';
import { configSchema } from '../../src/models/site/config.js';
import { AUDIT_TYPE_LHS_MOBILE } from '../../src/models/audit.js';

import generateSampleData from './generateSampleData.js';
import {
  createSiteCandidate,
  SITE_CANDIDATE_SOURCES,
  SITE_CANDIDATE_STATUS,
} from '../../src/models/site-candidate.js';
import { KEY_EVENT_TYPES } from '../../src/models/key-event.js';
import { ConfigurationDto } from '../../src/dto/configuration.js';
import { ImportJobStatus, ImportOptions, ImportUrlStatus } from '../../src/index.js';

use(chaiAsPromised);

function checkSite(site, configuration) {
  expect(site).to.be.an('object');
  expect(site.getId()).to.be.a('string');
  expect(site.getBaseURL()).to.be.a('string');
  expect(site.getDeliveryType()).to.be.a('string');
  expect(site.getGitHubURL()).to.be.a('string');
  expect(site.getHlxConfig()).to.be.an('object');
  expect(site.getOrganizationId()).to.be.a('string');
  expect(isIsoDate(site.getCreatedAt())).to.be.true;
  expect(isIsoDate(site.getUpdatedAt())).to.be.true;
  expect(site.getAudits()).to.be.an('array');
  expect(site.isLive()).to.be.a('boolean');
  expect(isIsoDate(site.getIsLiveToggledAt())).to.be.true;

  const lhsMobileHandler = configuration.getHandler(AUDIT_TYPE_LHS_MOBILE);
  const cwvHandler = configuration.getHandler('cwv');
  expect(lhsMobileHandler).to.be.an('object');
  expect(configuration.isHandlerEnabledForSite(AUDIT_TYPE_LHS_MOBILE, site)).to.be.a('boolean').which.is.true;
  expect(site.getConfig().getExcludedURLs(AUDIT_TYPE_LHS_MOBILE)).to.be.a('array').which.is.deep.equal(['https://example.com/excluded']);
  expect(configuration.getHandler('non-existing')).to.be.undefined;
  expect(cwvHandler).to.be.an('object');
  expect(configuration.isHandlerEnabledForSite('cwv', site)).to.be.a('boolean').which.is.false;
}

function checkOrganization(organization) {
  const schema = Joi.object({
    id: Joi.string(),
    name: Joi.string(),
    imsOrgId: Joi.string(),
    config: configSchema,
  });
  schema.validate(organization);
}

function checkAudit(audit) {
  expect(audit).to.be.an('object');
  expect(audit.getId()).to.be.a('string');
  expect(audit.getSiteId()).to.be.a('string');
  expect(audit.getAuditType()).to.be.a('string');
  expect(isIsoDate(audit.getAuditedAt())).to.be.true;
  expect(audit.getExpiresAt()).to.be.a('date');
  expect(audit.getAuditResult()).to.be.an('object');
  expect(audit.getScores()).to.be.an('object');
  expect(audit.getFullAuditRef()).to.be.a('string');
  expect(audit.isLive()).to.be.a('boolean');
}

function checkSiteTopPage(siteTopPage) {
  expect(siteTopPage).to.be.an('object');
  expect(siteTopPage.getSiteId()).to.be.a('string');
  expect(siteTopPage.getURL()).to.be.a('string');
  expect(siteTopPage.getTraffic()).to.be.a('number');
  expect(siteTopPage.getTopKeyword()).to.be.a('string');
  expect(siteTopPage.getSource()).to.be.a('string');
  expect(siteTopPage.getGeo()).to.be.a('string');
  expect(isIsoDate(siteTopPage.getImportedAt())).to.be.true;
}

const TEST_DA_CONFIG = {
  tableNameAudits: 'spacecat-services-audits',
  tableNameKeyEvents: 'spacecat-services-key-events',
  tableNameLatestAudits: 'spacecat-services-latest-audits',
  tableNameOrganizations: 'spacecat-services-organizations',
  tableNameSites: 'spacecat-services-sites',
  tableNameSiteCandidates: 'spacecat-services-site-candidates',
  tableNameConfigurations: 'spacecat-services-configurations',
  tableNameSiteTopPages: 'spacecat-services-site-top-pages',
  tableNameExperiments: 'spacecat-services-experiments',
  tableNameApiKeys: 'spacecat-services-api-keys',
  tableNameImportJobs: 'spacecat-services-import-jobs',
  tableNameImportUrls: 'spacecat-services-import-urls',
  indexNameAllSites: 'spacecat-services-all-sites',
  indexNameAllKeyEventsBySiteId: 'spacecat-services-key-events-by-site-id',
  indexNameAllSitesOrganizations: 'spacecat-services-all-sites-organizations',
  indexNameAllOrganizations: 'spacecat-services-all-organizations',
  indexNameAllOrganizationsByImsOrgId: 'spacecat-services-all-organizations-by-ims-org-id',
  indexNameAllSitesByDeliveryType: 'spacecat-services-all-sites-by-delivery-type',
  indexNameAllLatestAuditScores: 'spacecat-services-all-latest-audit-scores',
  indexNameAllImportJobsByStatus: 'spacecat-services-all-import-jobs-by-status',
  indexNameImportUrlsByJobIdAndStatus: 'spacecat-services-all-import-urls-by-job-id-and-status',
  indexNameAllImportJobsByDateRange: 'spacecat-services-all-import-jobs-by-date-range',
  pkAllSites: 'ALL_SITES',
  pkAllOrganizations: 'ALL_ORGANIZATIONS',
  pkAllLatestAudits: 'ALL_LATEST_AUDITS',
  pkAllConfigurations: 'ALL_CONFIGURATIONS',
  pkAllImportJobs: 'ALL_IMPORT_JOBS',
};

describe('DynamoDB Integration Test', async () => {
  let dynamoDbLocalProcess;
  let dataAccess;

  const NUMBER_OF_SITES = 10;
  const NUMBER_OF_SITES_CANDIDATES = 10;
  const NUMBER_OF_ORGANIZATIONS = 3;
  const NUMBER_OF_AUDITS_PER_TYPE_AND_SITE = 3;
  const NUMBER_OF_TOP_PAGES_PER_SITE = 5;
  const NUMBER_OF_TOP_PAGES_FOR_SITE = NUMBER_OF_SITES * NUMBER_OF_TOP_PAGES_PER_SITE;
  const NUMBER_OF_KEY_EVENTS_PER_SITE = 10;
  const NUMBER_OF_EXPERIMENTS = 3;

  before(async function beforeSuite() {
    this.timeout(30000);

    process.env.AWS_REGION = 'local';
    process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://127.0.0.1:8000';
    process.env.AWS_DEFAULT_REGION = 'local';
    process.env.AWS_ACCESS_KEY_ID = 'dummy';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy';

    dynamoDbLocalProcess = spawn({
      detached: true,
      stdio: 'inherit',
      port: 8000,
      sharedDb: true,
    });

    await sleep(10000); // give db time to start up

    try {
      await generateSampleData(
        TEST_DA_CONFIG,
        NUMBER_OF_ORGANIZATIONS,
        NUMBER_OF_SITES,
        NUMBER_OF_SITES_CANDIDATES,
        NUMBER_OF_AUDITS_PER_TYPE_AND_SITE,
        NUMBER_OF_TOP_PAGES_FOR_SITE,
        NUMBER_OF_KEY_EVENTS_PER_SITE,
      );
    } catch (e) {
      console.error('Error generating sample data', e);
    }

    dataAccess = createDataAccess(TEST_DA_CONFIG, console);
  });

  after(() => {
    dynamoDbLocalProcess.kill();
  });

  it('get all key events for a site', async () => {
    const siteId = (await dataAccess.getSiteByBaseURL('https://example0.com')).getId();

    const keyEvents = await dataAccess.getKeyEventsForSite(siteId);

    expect(keyEvents.length).to.equal(NUMBER_OF_KEY_EVENTS_PER_SITE);
    expect(keyEvents[0].getSiteId()).to.equal(siteId);
  });

  it('add a new key event for a site', async () => {
    const siteId = (await dataAccess.getSiteByBaseURL('https://example0.com')).getId();

    await dataAccess.createKeyEvent({
      siteId,
      name: 'new-key-event',
      type: KEY_EVENT_TYPES.CONTENT,
    });

    const keyEvents = await dataAccess.getKeyEventsForSite(siteId);

    expect(keyEvents.length).to.equal(NUMBER_OF_KEY_EVENTS_PER_SITE + 1);
  });

  it('remove a key event', async () => {
    const siteId = (await dataAccess.getSiteByBaseURL('https://example0.com')).getId();
    const keyEvents = await dataAccess.getKeyEventsForSite(siteId);

    await dataAccess.removeKeyEvent(keyEvents[0].getId());

    const keyEventsAfter = await dataAccess.getKeyEventsForSite(siteId);
    expect(keyEventsAfter.length).to.equal(NUMBER_OF_KEY_EVENTS_PER_SITE);
  });

  it('gets configuration by Version', async () => {
    const configuration = await dataAccess.getConfigurationByVersion('v1');

    expect(configuration).to.be.an('object');

    expect(configuration.getVersion()).to.equal('v1');
  });

  it('gets configuration', async () => {
    const configuration = await dataAccess.getConfiguration();

    expect(configuration).to.be.an('object');

    expect(configuration.getVersion()).to.equal('v2');
  });

  it('updates a configuration', async () => {
    const configurationData = {
      version: 'v2',
      queues: {
        audits: 'audits-queue',
        imports: 'imports-queue',
        reports: 'reports-queue',
      },
      jobs: [
        { group: 'audits', interval: 'daily', type: 'some-audit' },
        { group: 'reports', interval: 'daily', type: 'some-report' },
      ],
    };
    const configurationV2 = await dataAccess.getConfiguration();
    const configuration = await dataAccess.updateConfiguration({
      ...ConfigurationDto.toDynamoItem(configurationV2),
      ...configurationData,
    });

    expect(configuration).to.be.an('object');

    expect(configuration.getVersion()).to.equal('v3');
    expect(configuration.getQueues()).to.deep.equal(configurationData.queues);
    expect(configuration.getJobs()).to.deep.equal(configurationData.jobs);
    expect(configuration.getHandlers()).to.deep.equal(configurationV2.getHandlers());
  });

  it('gets organizations', async () => {
    const organizations = await dataAccess.getOrganizations();

    expect(organizations.length).to.equal(NUMBER_OF_ORGANIZATIONS);

    organizations.forEach((organization) => {
      checkOrganization(organization);
    });
  });

  it('gets organization by ID', async () => {
    const orgId = (await dataAccess.getOrganizations())[0].getId();
    const organization = await dataAccess.getOrganizationByID(orgId);

    expect(organization).to.be.an('object');

    checkOrganization(organization);
    expect(organization.getId()).to.equal(orgId);
  });

  it('sets a single audit disabled for an organization', async () => {
    const orgId = (await dataAccess.getOrganizations())[1].getId();
    const organization = await dataAccess.getOrganizationByID(orgId);
    const configuration = await dataAccess.getConfiguration();
    configuration.addHandler('hebele', { enabledByDefault: true });
    configuration.disableHandlerForOrg('hebele', organization);
    await dataAccess.updateOrganization(organization);
    const updatedConfiguration = await dataAccess.updateConfiguration(
      ConfigurationDto.toDynamoItem(configuration),
    );

    const organizationUpdated = await dataAccess.getOrganizationByID(orgId);
    expect(updatedConfiguration.isHandlerEnabledForOrg('hebele', organizationUpdated)).to.be.false;
  });

  it('gets organization by IMS Org ID', async () => {
    const imsOrgId = (await dataAccess.getOrganizations())[0].getImsOrgId();
    const organization = await dataAccess.getOrganizationByImsOrgID(imsOrgId);

    expect(organization).to.be.an('object');

    checkOrganization(organization);
    expect(organization.getImsOrgId()).to.equal(imsOrgId);
  });

  it('adds a new organization', async () => {
    const organizationId = uuidv4();
    const newOrgData = {
      id: organizationId,
      imsOrgId: '1234@AdobeOrg',
      name: 'Org1',
    };

    const addedOrg = await dataAccess.addOrganization(newOrgData);

    expect(addedOrg).to.be.an('object');

    const newOrg = await dataAccess.getOrganizationByID(organizationId);

    checkOrganization(newOrg);

    expect(newOrg.getName()).to.equal(newOrgData.name);
    expect(newOrg.getImsOrgId()).to.equal(newOrgData.imsOrgId);
    expect(newOrg.getConfig()).to.be.an('object');
  });

  it('updates an existing org', async () => {
    const orgToUpdate = (await dataAccess.getOrganizations())[0];
    const originalUpdatedAt = orgToUpdate.getUpdatedAt();
    const newName = 'updatedName123';
    const newImsOrgId = 'updatedOrg123';

    await sleep(10); // Make sure updatedAt is different

    orgToUpdate.updateImsOrgId(newImsOrgId);
    orgToUpdate.updateName(newName);

    const updatedOrg = await dataAccess.updateOrganization(orgToUpdate);

    expect(updatedOrg.getImsOrgId()).to.equal(newImsOrgId);
    expect(updatedOrg.getName()).to.equal(newName);
    expect(updatedOrg.getUpdatedAt()).to.not.equal(originalUpdatedAt);
  });

  it('gets sites', async () => {
    const sites = await dataAccess.getSites();
    const configuration = await dataAccess.getConfiguration();

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(0);
    });
  });

  it('gets sites by delivery type', async () => {
    const sites = await dataAccess.getSitesByDeliveryType('aem_cs');
    const configuration = await dataAccess.getConfiguration();

    expect(sites.length).to.equal(NUMBER_OF_SITES / 2);

    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(0);
    });
  });

  it('gets sites by organizationId', async () => {
    const organizations = await dataAccess.getOrganizations();
    const sites = await dataAccess.getSitesByOrganizationID(organizations[0].getId());
    const configuration = await dataAccess.getConfiguration();

    expect(sites.length).to.be.lessThanOrEqual(Math.trunc(NUMBER_OF_SITES / NUMBER_OF_ORGANIZATIONS)
      + (NUMBER_OF_SITES % NUMBER_OF_ORGANIZATIONS));

    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getOrganizationId()).to.be.equal(organizations[0].getId());
    });
  });

  it('gets sites to audit', async () => {
    const sites = await dataAccess.getSitesToAudit();

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((siteId) => {
      expect(siteId).to.be.a('string');
    });
  });

  it('gets sites with latest audit', async () => {
    const sites = await dataAccess.getSitesWithLatestAudit(AUDIT_TYPE_LHS_MOBILE);
    const configuration = await dataAccess.getConfiguration();

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getAudits()).to.be.an('array');

      site.getAudits().forEach((audit) => {
        expect(audit.getAuditType()).to.equal(AUDIT_TYPE_LHS_MOBILE);
        expect(Object.keys(audit.getScores())).to.have.members(
          ['performance', 'seo', 'accessibility', 'best-practices'],
        );
      });
    });
  });

  it('gets sites by organization ID with latest audit', async () => {
    const organizations = await dataAccess.getOrganizations();
    const sites = await dataAccess.getSitesByOrganizationIDWithLatestAudits(
      organizations[0].getId(),
      AUDIT_TYPE_LHS_MOBILE,
    );
    const configuration = await dataAccess.getConfiguration();
    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getAudits()).to.be.an('array');

      site.getAudits().forEach((audit) => {
        expect(audit.getAuditType()).to.equal(AUDIT_TYPE_LHS_MOBILE);
        expect(Object.keys(audit.getScores())).to.have.members(
          ['performance', 'seo', 'accessibility', 'best-practices'],
        );
      });
    });
  });

  it('gets sites with latest audit of delivery type', async () => {
    const sites = await dataAccess.getSitesWithLatestAudit(AUDIT_TYPE_LHS_MOBILE, true, 'aem_cs');
    const configuration = await dataAccess.getConfiguration();

    expect(sites.length).to.equal(NUMBER_OF_SITES / 2);

    sites.forEach((site) => {
      checkSite(site, configuration);
      expect(site.getDeliveryType()).to.equal('aem_cs');
      expect(site.getAudits()).to.be.an('array');

      site.getAudits().forEach((audit) => {
        expect(audit.getAuditType()).to.equal(AUDIT_TYPE_LHS_MOBILE);
        expect(Object.keys(audit.getScores())).to.have.members(
          ['performance', 'seo', 'accessibility', 'best-practices'],
        );
      });
    });
  });

  it('gets site by baseURL', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const configuration = await dataAccess.getConfiguration();

    expect(site).to.be.an('object');

    checkSite(site, configuration);
  });

  it('gets site by ID', async () => {
    const siteId = (await dataAccess.getSites())[0].getId();
    const site = await dataAccess.getSiteByID(siteId);
    const configuration = await dataAccess.getConfiguration();

    expect(site).to.be.an('object');

    checkSite(site, configuration);
    expect(site.getId()).to.equal(siteId);
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
      organizationId: '1234',
      isLive: true,
      isLiveToggledAt: new Date().toISOString(),
      audits: [],
      config: {
        handlers: {
          'lhs-mobile': {
            excludedURLs: ['https://example.com/excluded'],
          },
        },
      },
    };

    const addedSite = await dataAccess.addSite(newSiteData);
    const configuration = await dataAccess.getConfiguration();
    configuration.disableHandlerForSite('cwv', addedSite);
    const updatedConfiguration = await dataAccess.updateConfiguration(
      ConfigurationDto.toDynamoItem(configuration),
    );

    expect(addedSite).to.be.an('object');

    const newSite = await dataAccess.getSiteByBaseURL(newSiteData.baseURL);

    checkSite(newSite, updatedConfiguration);

    expect(newSite.getId()).to.to.be.a('string');
    expect(newSite.getBaseURL()).to.equal(newSiteData.baseURL);
    expect(newSite.getGitHubURL()).to.equal(newSiteData.gitHubURL);
    expect(newSite.getHlxConfig()).to.deep.equal(newSiteData.hlxConfig);
    expect(newSite.getOrganizationId()).to.equal(newSiteData.organizationId);
    expect(newSite.getAudits()).to.be.an('array').that.is.empty;
  });

  it('updates an existing site', async () => {
    const siteToUpdate = await dataAccess.getSiteByBaseURL('https://example1.com');
    const originalUpdatedAt = siteToUpdate.getUpdatedAt();
    const newDeliveryType = 'aem_cs';
    const newGitHubURL = 'https://github.com/newOrg/some-repo';
    const newOrgId = 'updatedOrg123';
    const newHlxConfig = {
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
    };

    await sleep(10); // Make sure updatedAt is different

    siteToUpdate.updateDeliveryType(newDeliveryType);
    siteToUpdate.updateGitHubURL(newGitHubURL);
    siteToUpdate.updateHlxConfig(newHlxConfig);
    siteToUpdate.updateOrganizationId(newOrgId);
    siteToUpdate.toggleLive();

    const updatedSite = await dataAccess.updateSite(siteToUpdate);

    expect(updatedSite.getDeliveryType()).to.equal(newDeliveryType);
    expect(updatedSite.getGitHubURL()).to.equal(newGitHubURL);
    expect(updatedSite.getHlxConfig()).to.deep.equal(newHlxConfig);
    expect(updatedSite.getOrganizationId()).to.equal(newOrgId);
    expect(updatedSite.isLive()).to.be.false;
    expect(updatedSite.getUpdatedAt()).to.not.equal(originalUpdatedAt);
  });

  it('retrieves all audits for a site', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();
    const audits = await dataAccess.getAuditsForSite(siteId);

    expect(audits).to.be.an('array').that.has.lengthOf(NUMBER_OF_AUDITS_PER_TYPE_AND_SITE * 2);

    audits.forEach((audit) => {
      checkAudit(audit);
      expect(audit.getSiteId()).to.equal(siteId);
    });
  });

  it('retrieves audits of a specific type for a site', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();
    const auditType = AUDIT_TYPE_LHS_MOBILE;
    const audits = await dataAccess.getAuditsForSite(siteId, auditType);

    expect(audits).to.be.an('array').that.has.lengthOf(NUMBER_OF_AUDITS_PER_TYPE_AND_SITE);

    audits.forEach((audit) => {
      checkAudit(audit);
      expect(audit.getSiteId()).to.equal(siteId);
      expect(audit.getAuditType()).to.equal(auditType);
    });
  });

  it('retrieves a specific audit for a site', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();
    const auditType = AUDIT_TYPE_LHS_MOBILE;
    const audits = await dataAccess.getAuditsForSite(site.getId(), auditType);
    const auditedAt = audits[0].getAuditedAt();

    const audit = await dataAccess.getAuditForSite(siteId, auditType, auditedAt);

    checkAudit(audit);

    expect(audit.getSiteId()).to.equal(siteId);
    expect(audit.getAuditType()).to.equal(auditType);
    expect(audit.getAuditedAt()).to.equal(auditedAt);
  });

  it('returns null for non-existing audit', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();
    const auditType = 'non-existing-type';
    const auditedAt = '2023-01-01T00:00:00Z';

    const audit = await dataAccess.getAuditForSite(siteId, auditType, auditedAt);

    expect(audit).to.be.null;
  });

  it('retrieves the latest audits of a specific type', async () => {
    const audits = await dataAccess.getLatestAudits(AUDIT_TYPE_LHS_MOBILE, true);

    // Every tenth site will not have any audits
    expect(audits).to.be.an('array').that.has.lengthOf(NUMBER_OF_SITES - 1);

    audits.forEach((audit) => {
      checkAudit(audit);
      expect(audit.getAuditType()).to.equal(AUDIT_TYPE_LHS_MOBILE);
    });

    // verify the sorting order
    let lastScoresString = '';
    audits.forEach((audit) => {
      const currentScoresString = `${AUDIT_TYPE_LHS_MOBILE}#${Object.keys(audit.getScores()).join('#')}`;
      expect(currentScoresString.localeCompare(lastScoresString)).to.be.at.least(0);
      lastScoresString = currentScoresString;
    });
  });

  it('retrieves the latest audits in descending order', async () => {
    const audits = await dataAccess.getLatestAudits(AUDIT_TYPE_LHS_MOBILE, false);

    expect(audits).to.be.an('array').that.has.lengthOf(NUMBER_OF_SITES - 1);

    // verify the sorting order is descending
    // assuming 'z' will be lexicographically after any realistic score string
    let lastScoresString = 'z';
    audits.forEach((audit) => {
      const currentScoresString = `${AUDIT_TYPE_LHS_MOBILE}#${Object.keys(audit.getScores()).join('#')}`;
      expect(currentScoresString.localeCompare(lastScoresString)).to.be.at.most(0);
      lastScoresString = currentScoresString;
    });
  });

  it('retrieves the latest audit for a specific site and audit type', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();

    const latestAudit = await dataAccess.getLatestAuditForSite(siteId, AUDIT_TYPE_LHS_MOBILE);

    checkAudit(latestAudit);
    expect(latestAudit.getSiteId()).to.equal(siteId);
    expect(latestAudit.getAuditType()).to.equal(AUDIT_TYPE_LHS_MOBILE);

    const allAudits = await dataAccess.getAuditsForSite(siteId, AUDIT_TYPE_LHS_MOBILE);
    const mostRecentAudit = allAudits.reduce((latest, current) => (
      new Date(latest.getAuditedAt()) > new Date(current.getAuditedAt()) ? latest : current
    ));

    expect(latestAudit.getAuditedAt()).to.equal(mostRecentAudit.getAuditedAt());
  });

  it('returns null for a site with no audits of the specified type', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = site.getId();
    const auditType = 'non-existing-type';

    const latestAudit = await dataAccess.getLatestAuditForSite(siteId, auditType);

    expect(latestAudit).to.be.null;
  });

  it('successfully adds a new audit', async () => {
    const auditData = {
      siteId: 'https://example1.com',
      auditType: AUDIT_TYPE_LHS_MOBILE,
      auditedAt: new Date().toISOString(),
      isLive: true,
      fullAuditRef: 's3://ref',
      auditResult: {
        scores: {
          performance: 0,
          seo: 0,
          accessibility: 0,
          'best-practices': 0,
        },
      },
    };

    const newAudit = await dataAccess.addAudit(auditData);

    checkAudit(newAudit);
    expect(newAudit.getSiteId()).to.equal(auditData.siteId);
    expect(newAudit.getAuditType()).to.equal(auditData.auditType);
    expect(newAudit.getAuditedAt()).to.equal(auditData.auditedAt);
    expect(newAudit.isLive()).to.be.a('boolean').that.is.true;

    // Retrieve the latest audit for the site from the latest_audits table
    const latestAudit = await dataAccess.getLatestAuditForSite(
      auditData.siteId,
      auditData.auditType,
    );

    checkAudit(latestAudit);
    expect(latestAudit.getSiteId()).to.equal(auditData.siteId);
    expect(latestAudit.getAuditType()).to.equal(auditData.auditType);
    expect(latestAudit.getAuditedAt()).to.equal(auditData.auditedAt);

    const additionalAuditData = {
      siteId: 'https://example1.com',
      auditType: AUDIT_TYPE_LHS_MOBILE,
      auditedAt: new Date().toISOString(),
      isLive: true,
      fullAuditRef: 's3://ref',
      auditResult: {
        scores: {
          performance: 1,
          seo: 1,
          accessibility: 1,
          'best-practices': 1,
        },
      },
    };

    const anotherAudit = await dataAccess.addAudit(additionalAuditData);

    checkAudit(anotherAudit);
    expect(anotherAudit.getPreviousAuditResult()).to.deep.equal({
      ...newAudit.getAuditResult(),
      auditedAt: newAudit.getAuditedAt(),
      fullAuditRef: newAudit.getFullAuditRef(),
    });
  });

  it('throws an error when adding a duplicate audit', async () => {
    const auditData = {
      siteId: 'https://example1.com',
      auditType: AUDIT_TYPE_LHS_MOBILE,
      auditedAt: new Date().toISOString(),
      fullAuditRef: 's3://ref',
      isLive: true,
      auditResult: {
        scores: {
          performance: 0,
          seo: 0,
          accessibility: 0,
          'best-practices': 0,
        },
      },
    };

    await dataAccess.addAudit(auditData);

    // Try to add the same audit again
    await expect(dataAccess.addAudit(auditData)).to.be.rejectedWith('Audit already exists');
  });

  it('successfully removes a site and its related audits', async () => {
    const siteToRemove = await dataAccess.getSiteByBaseURL('https://example1.com');
    const siteId = siteToRemove.getId();

    await expect(dataAccess.removeSite(siteId)).to.eventually.be.fulfilled;

    const siteAfterRemoval = await dataAccess.getSiteByBaseURL('https://example1.com');
    expect(siteAfterRemoval).to.be.null;

    const auditsAfterRemoval = await dataAccess.getAuditsForSite(siteId);
    expect(auditsAfterRemoval).to.be.an('array').that.is.empty;

    const latestAuditAfterRemoval = await dataAccess.getLatestAuditForSite(
      siteId,
      AUDIT_TYPE_LHS_MOBILE,
    );
    expect(latestAuditAfterRemoval).to.be.null;
  });

  it('verify a previously added site candidate exists', async () => {
    const exists = await dataAccess.siteCandidateExists('https://example0.com');
    expect(exists).to.be.true;
  });

  it('verify a previously non-added site candidate does not exist', async () => {
    const exists = await dataAccess.siteCandidateExists('https://non-existing-site.com');
    expect(exists).to.be.false;
  });

  it('verify the upsert site candidate flow', async () => {
    const siteCandidateData = {
      baseURL: 'https://some-base-url.com',
      status: SITE_CANDIDATE_STATUS.IGNORED,
    };

    const siteCandidate = await dataAccess.upsertSiteCandidate(siteCandidateData);

    const exists = await dataAccess.siteCandidateExists('https://some-base-url.com');
    expect(exists).to.be.true;

    expect(siteCandidate.getBaseURL()).to.equal(siteCandidateData.baseURL);
    expect(siteCandidate.getStatus()).to.equal(SITE_CANDIDATE_STATUS.IGNORED);
  });

  it('verify the update site candidate flow', async () => {
    const siteCandidateData = {
      baseURL: 'https://example0.com',
      status: SITE_CANDIDATE_STATUS.APPROVED,
      siteId: 'some-site-id',
      source: SITE_CANDIDATE_SOURCES.CDN,
    };

    const updatedSiteCandidate = await dataAccess.updateSiteCandidate(
      createSiteCandidate(siteCandidateData),
    );

    expect(updatedSiteCandidate.getBaseURL()).to.equal(siteCandidateData.baseURL);
    expect(updatedSiteCandidate.getSiteId()).to.equal(siteCandidateData.siteId);
    expect(updatedSiteCandidate.getSource()).to.equal(siteCandidateData.source);
    expect(updatedSiteCandidate.getStatus()).to.equal(siteCandidateData.status);
  });

  it('verify the get site candidate by base url flow', async () => {
    const siteCandidate = await dataAccess.getSiteCandidateByBaseURL('https://example2.com');

    expect(siteCandidate.getBaseURL()).to.equal('https://example2.com');
    expect(siteCandidate.getStatus()).to.equal(SITE_CANDIDATE_STATUS.PENDING);
    expect(siteCandidate.getSource()).to.be.undefined;
    expect(siteCandidate.getSiteId()).to.be.undefined;
  });

  it('successfully adds a new top page', async () => {
    const siteId = (await dataAccess.getSites())[0].getId();

    const siteTopPageData = {
      siteId,
      url: 'https://example12345.com/page-12345',
      traffic: 360420000,
      topKeyword: 'keyword12345',
      source: 'rum',
      geo: 'au',
      importedAt: new Date().toISOString(),
    };

    const newSiteTopPage = await dataAccess.addSiteTopPage(siteTopPageData);

    checkSiteTopPage(newSiteTopPage);
    expect(newSiteTopPage.getSiteId()).to.equal(siteTopPageData.siteId);
    expect(newSiteTopPage.getTraffic()).to.equal(siteTopPageData.traffic);
    expect(newSiteTopPage.getSource()).to.equal(siteTopPageData.source);
    expect(newSiteTopPage.getGeo()).to.equal(siteTopPageData.geo);
    expect(newSiteTopPage.getImportedAt()).to.equal(siteTopPageData.importedAt);

    const topPages = await dataAccess.getTopPagesForSite(
      siteTopPageData.siteId,
      siteTopPageData.source,
      siteTopPageData.geo,
    );

    expect(topPages).to.be.an('array').that.has.lengthOf(1);
    const topPage = topPages[0];
    checkSiteTopPage(topPage);
    expect(topPage.getSiteId()).to.equal(siteTopPageData.siteId);
    expect(topPage.getTraffic()).to.equal(siteTopPageData.traffic);
    expect(topPage.getSource()).to.equal(siteTopPageData.source);
    expect(topPage.getGeo()).to.equal(siteTopPageData.geo);
    expect(topPage.getImportedAt()).to.equal(siteTopPageData.importedAt);
  });

  it('retrieves top pages for a site from a specific source and geo in descending traffic order', async () => {
    const siteId = (await dataAccess.getSites())[0].getId();

    const siteTopPages = await dataAccess.getTopPagesForSite(siteId, 'ahrefs', 'global');

    expect(siteTopPages.length).to.equal(NUMBER_OF_TOP_PAGES_PER_SITE);

    siteTopPages.forEach((topPage) => {
      checkSiteTopPage(topPage);
    });

    for (let i = 1; i < siteTopPages.length; i += 1) {
      expect(siteTopPages[i - 1].getTraffic()).to.be.at.least(siteTopPages[i].getTraffic());
    }
  });

  it('removes top pages for a site', async () => {
    const siteId = (await dataAccess.getSites())[0].getId();

    await expect(dataAccess.removeSiteTopPages(siteId, 'ahrefs', 'global')).to.eventually.be.fulfilled;

    const topPagesAfterRemoval = await dataAccess.getTopPagesForSite(siteId, 'ahrefs', 'global');
    expect(topPagesAfterRemoval).to.be.an('array').that.is.empty;
  });

  it('get all experiments for the site', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example0.com');
    const siteId = site.getId();
    const experiments = await dataAccess.getExperiments(siteId);

    expect(experiments.length).to.equal(NUMBER_OF_EXPERIMENTS);
  });

  it('get all experiments for the site and experimentId', async () => {
    // handling multi page experiments
    const site = await dataAccess.getSiteByBaseURL('https://example0.com');
    const siteId = site.getId();
    const experiments = await dataAccess.getExperiments(siteId, 'experiment-1');

    expect(experiments.length).to.equal(1);
  });

  it('get 0 experiments for the siteId with out any experiments', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example3.com');
    const siteId = site.getId();
    const experiments = await dataAccess.getExperiments(siteId);

    expect(experiments.length).to.equal(0);
  });

  it('check if experiment exists', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example0.com');
    const siteId = site.getId();
    const experiment = await dataAccess.getExperiment(siteId, 'experiment-1', `${site.getBaseURL()}/page-1`);

    expect(experiment).to.not.equal(null);
  });

  it('create and update experiment', async () => {
    const site = await dataAccess.getSiteByBaseURL('https://example0.com');
    const siteId = site.getId();
    const experimentData = {
      siteId,
      experimentId: 'experiment-test',
      name: 'Experiment Test',
      url: `${site.getBaseURL()}/page-10`,
      status: 'active',
      type: 'full',
      variants: [
        {
          label: 'Challenger 1',
          name: 'challenger-1',
          interactionsCount: 40,
          p_value: 'coming soon',
          split: 0.5,
          url: `${site.getBaseURL()}/page-10/variant-1`,
          views: 1100,
          metrics: [
            {
              selector: '.header .button',
              type: 'click',
              value: 40,
            }],
        },
        {
          label: 'Control',
          name: 'control',
          interactionsCount: 0,
          p_value: 'coming soon',
          metrics: [],
          split: 0.5,
          url: `${site.getBaseURL()}/page-10`,
          views: 1090,
        },
      ],
      startDate: new Date().toISOString(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'it-test',
    };
    await dataAccess.upsertExperiment(experimentData);
    const experimentTest = await dataAccess.getExperiment(siteId, 'experiment-test', `${site.getBaseURL()}/page-10`);
    expect(experimentTest).to.not.equal(null);
    // update the experiment variant 0 metrics to 50
    experimentData.variants[0].metrics[0].value = 50;
    await dataAccess.upsertExperiment(experimentData);
    const updatedExperiment = await dataAccess.getExperiment(siteId, 'experiment-test', `${site.getBaseURL()}/page-10`);
    expect(updatedExperiment.getVariants()[0].metrics[0].value).to.equal(50);
  });

  /** Please keep this test at the last, the remove organization is removing the org randomly,
   * moving this  above may remove the org which may have sites required by other tests */
  it('removes organization', async () => {
    const organizations = await dataAccess.getOrganizations();
    const organization = organizations[0];
    await expect(dataAccess.removeOrganization(organization.getId())).to.eventually.be.fulfilled;
    const organizationAfterRemoval = await dataAccess.getOrganizationByID(organization.getId());
    expect(organizationAfterRemoval).to.be.null;
  });

  /**
   * The following section is related to the Importer.
   * It includes tests for the ImportJob and ImportUrl Data Access APIs.
   *
   * Before running the tests inject a ImportJob and ImportUrl into their respective tables.
   * This is done such that each test could be executed individually without the need to run the
   * entire suite.
   */
  describe('Importer Tests', async () => {
    const startTime = new Date().toISOString();

    // helper
    const createNewImportJob = async () => dataAccess.createNewImportJob({
      urls: ['https://example.com/cars', 'https://example.com/bikes'],
      importQueueId: 'Q-123',
      hashedApiKey: '1234',
      baseURL: 'https://example.com/cars',
      startTime,
      status: ImportJobStatus.RUNNING,
      initiatedBy: {
        apiKeyName: 'K-123',
      },
      options: {
        [ImportOptions.ENABLE_JAVASCRIPT]: true,
      },
      hasCustomImportJs: true,
      hasCustomHeaders: false,
    });

    // helper
    const createNewImportUrl = async (importJob) => dataAccess.createNewImportUrl({
      url: 'https://example.com/cars',
      jobId: importJob.getId(),
      status: ImportUrlStatus.PENDING,
    });

    describe('Import Job Tests', async () => {
      it('Verify the creation of the import job.', async () => {
        const job = await createNewImportJob();
        expect(job.getId()).to.be.a('string');
        expect(job.getCreatedAt()).to.be.a('string');
        expect(job.hasCustomHeaders()).to.be.false;
        expect(job.hasCustomImportJs()).to.be.true;
      });

      it('Verify updateImportJob', async () => {
        const job = await createNewImportJob();
        const newJob = { ...job };
        const newEndTime = new Date().toISOString();
        newJob.updateStatus(ImportJobStatus.COMPLETE);
        newJob.updateEndTime(newEndTime);
        newJob.updateDuration(1234);
        newJob.updateUrlCount(100);
        newJob.updateImportQueueId('Q-456');
        newJob.updateHasCustomHeaders(true);

        const updatedJob = await dataAccess.updateImportJob(newJob);

        expect(updatedJob.getStatus()).to.be.equal(ImportJobStatus.COMPLETE);
        expect(updatedJob.getEndTime()).to.equal(newEndTime);
        expect(updatedJob.getDuration()).to.be.equal(1234);
        expect(updatedJob.getUrlCount()).to.be.equal(100);
        expect(updatedJob.getImportQueueId()).to.be.equal('Q-456');
        expect(updatedJob.getOptions()).to.deep.equal({
          [ImportOptions.ENABLE_JAVASCRIPT]: true,
        });
        expect(updatedJob.hasCustomHeaders()).to.be.true;
      });

      it('Verify getImportJobsByStatus', async () => {
        const job = await createNewImportJob();
        job.updateStatus(ImportJobStatus.FAILED);
        await dataAccess.updateImportJob(job);
        const result = await dataAccess.getImportJobsByStatus(ImportJobStatus.FAILED);
        expect(result.length).to.be.greaterThan(0);
      });

      it('Verify getImportJobByID', async () => {
        const job = await createNewImportJob();
        const jobEntry = await dataAccess.getImportJobByID(job.getId());
        expect(job.getId()).to.be.equal(jobEntry.getId());
      });

      it('Verify getImportJobsByDateRange', async () => {
        const endDate = new Date().toISOString();
        const jobs = await dataAccess.getImportJobsByDateRange(startTime, endDate);
        expect(jobs.length).to.be.greaterThan(0);
      });
    });

    describe('Import URL Tests', async () => {
      it('Verify the creation of a new import url.', async () => {
        const job = await createNewImportJob();
        const url = await createNewImportUrl(job);

        expect(url.getId()).to.be.a('string');
        expect(url.getJobId()).to.equal(job.getId());
      });

      it('Verify getImportUrlById', async () => {
        const job = await createNewImportJob();
        const url = await createNewImportUrl(job);
        const urlRow = await dataAccess.getImportUrlById(url.getId());
        expect(urlRow.getId()).to.be.equal(url.getId());
      });

      it('Verify getImportUrlsByJobId', async () => {
        const job = await createNewImportJob();
        await createNewImportUrl(job);
        const urlRow = await dataAccess.getImportUrlsByJobId(job.getId());
        expect(urlRow.length).to.be.greaterThan(0);
      });

      it('Verify getImportUrlsByJobIdAndStatus', async () => {
        const job = await createNewImportJob();
        await createNewImportUrl(job);

        const urlRows = await dataAccess
          .getImportUrlsByJobIdAndStatus(job.getId(), ImportUrlStatus.PENDING);
        expect(urlRows.length).to.be.greaterThan(0);
      });

      it('Verify updateImportUrl', async () => {
        const job = await createNewImportJob();
        const url = await createNewImportUrl(job);

        const newUrl = { ...url };
        newUrl.setStatus(ImportUrlStatus.COMPLETE);
        newUrl.setReason('Just Because');
        newUrl.setPath('/path/to/file');
        newUrl.setFile('thefile.docx');

        const updatedUrl = await dataAccess.updateImportUrl(newUrl);

        expect(updatedUrl.getStatus()).to.be.equal(ImportUrlStatus.COMPLETE);
        expect(updatedUrl.getReason()).to.be.equal('Just Because');
        expect(updatedUrl.getPath()).to.be.equal('/path/to/file');
        expect(updatedUrl.getFile()).to.be.equal('thefile.docx');
      });
    });
  });
});
