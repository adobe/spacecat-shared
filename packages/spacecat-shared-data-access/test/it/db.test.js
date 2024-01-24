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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import dynamoDbLocal from 'dynamo-db-local';
import Joi from 'joi';

import { isIsoDate } from '@adobe/spacecat-shared-utils';
import { v4 as uuidv4 } from 'uuid';
import { sleep } from '../unit/util.js';
import { createDataAccess } from '../../src/service/index.js';
import { configSchema } from '../../src/models/site/config.js';
import { AUDIT_TYPE_LHS_MOBILE } from '../../src/models/audit.js';

import generateSampleData from './generateSampleData.js';

const { expect } = chai;
chai.use(chaiAsPromised);

function checkSite(site) {
  expect(site).to.be.an('object');
  expect(site.getId()).to.be.a('string');
  expect(site.getBaseURL()).to.be.a('string');
  expect(site.getDeliveryType()).to.be.a('string');
  expect(site.getGitHubURL()).to.be.a('string');
  expect(site.getOrganizationId()).to.be.a('string');
  expect(isIsoDate(site.getCreatedAt())).to.be.true;
  expect(isIsoDate(site.getUpdatedAt())).to.be.true;
  expect(site.getAudits()).to.be.an('array');
  expect(site.isLive()).to.be.a('boolean');
  expect(isIsoDate(site.getIsLiveToggledAt())).to.be.true;

  const auditConfig = site.getAuditConfig();
  expect(auditConfig).to.be.an('object');
  expect(auditConfig.auditsDisabled()).to.be.a('boolean').which.is.false;
  expect(auditConfig.getAuditTypeConfig(AUDIT_TYPE_LHS_MOBILE)).to.be.an('object');
  expect(auditConfig.getAuditTypeConfig(AUDIT_TYPE_LHS_MOBILE).disabled()).to.be.a('boolean').which.is.false;
  expect(auditConfig.getAuditTypeConfig('non-existing-type')).to.be.undefined;
  expect(auditConfig.getAuditTypeConfig('cwv')).to.be.an('object');
  expect(auditConfig.getAuditTypeConfig('cwv').disabled()).to.be.a('boolean').which.is.true;
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

const TEST_DA_CONFIG = {
  tableNameAudits: 'spacecat-services-audits',
  tableNameLatestAudits: 'spacecat-services-latest-audits',
  tableNameOrganizations: 'spacecat-services-organizations',
  tableNameSites: 'spacecat-services-sites',
  indexNameAllSites: 'spacecat-services-all-sites',
  indexNameAllSitesOrganizations: 'spacecat-services-all-sites-organizations',
  indexNameAllOrganizations: 'spacecat-services-all-organizations',
  indexNameAllSitesByDeliveryType: 'spacecat-services-all-sites-by-delivery-type',
  indexNameAllLatestAuditScores: 'spacecat-services-all-latest-audit-scores',
  pkAllSites: 'ALL_SITES',
  pkAllOrganizations: 'ALL_ORGANIZATIONS',
  pkAllLatestAudits: 'ALL_LATEST_AUDITS',
};

describe('DynamoDB Integration Test', async () => {
  let dynamoDbLocalProcess;
  let dataAccess;

  const NUMBER_OF_SITES = 10;
  const NUMBER_OF_ORGANIZATIONS = 3;
  const NUMBER_OF_AUDITS_PER_TYPE_AND_SITE = 3;

  before(async function () {
    this.timeout(20000);

    process.env.AWS_REGION = 'local';
    process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://127.0.0.1:8000';
    process.env.AWS_DEFAULT_REGION = 'local';
    process.env.AWS_ACCESS_KEY_ID = 'dummy';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy';

    dynamoDbLocalProcess = dynamoDbLocal.spawn({ port: 8000, sharedDb: true });

    await sleep(5000); // give db time to start up

    await generateSampleData(
      TEST_DA_CONFIG,
      NUMBER_OF_ORGANIZATIONS,
      NUMBER_OF_SITES,
      NUMBER_OF_AUDITS_PER_TYPE_AND_SITE,
    );

    dataAccess = createDataAccess(TEST_DA_CONFIG, console);
  });

  after(() => {
    dynamoDbLocalProcess.kill();
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

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((site) => {
      checkSite(site);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(0);
    });
  });

  it('gets sites by delivery type', async () => {
    const sites = await dataAccess.getSitesByDeliveryType('aem_cs');

    expect(sites.length).to.equal(NUMBER_OF_SITES / 2);

    sites.forEach((site) => {
      checkSite(site);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(0);
    });
  });

  it('gets sites by organizationId', async () => {
    const organizations = await dataAccess.getOrganizations();
    const sites = await dataAccess.getSitesByOrganizationID(organizations[0].getId());

    expect(sites.length).to.be.lessThanOrEqual(Math.trunc(NUMBER_OF_SITES / NUMBER_OF_ORGANIZATIONS)
        + (NUMBER_OF_SITES % NUMBER_OF_ORGANIZATIONS));

    sites.forEach((site) => {
      checkSite(site);
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

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((site) => {
      checkSite(site);
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

    expect(sites.length).to.equal(NUMBER_OF_SITES / 2);

    sites.forEach((site) => {
      checkSite(site);
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

    expect(site).to.be.an('object');

    checkSite(site);
  });

  it('gets site by ID', async () => {
    const siteId = (await dataAccess.getSites())[0].getId();
    const site = await dataAccess.getSiteByID(siteId);

    expect(site).to.be.an('object');

    checkSite(site);
    expect(site.getId()).to.equal(siteId);
  });

  it('adds a new site', async () => {
    const newSiteData = {
      baseURL: 'https://newexample.com',
      gitHubURL: 'https://github.com/some-org/test-repo',
      organizationId: '1234',
      isLive: true,
      isLiveToggledAt: new Date().toISOString(),
      audits: [],
      auditConfig: {
        auditsDisabled: false,
        auditTypeConfigs: {
          'lhs-mobile': { disabled: false },
          cwv: { disabled: true },
        },
      },
    };

    const addedSite = await dataAccess.addSite(newSiteData);

    expect(addedSite).to.be.an('object');

    const newSite = await dataAccess.getSiteByBaseURL(newSiteData.baseURL);

    checkSite(newSite);

    expect(newSite.getId()).to.to.be.a('string');
    expect(newSite.getBaseURL()).to.equal(newSiteData.baseURL);
    expect(newSite.getGitHubURL()).to.equal(newSiteData.gitHubURL);
    expect(newSite.getOrganizationId()).to.equal(newSiteData.organizationId);
    expect(newSite.getAudits()).to.be.an('array').that.is.empty;
  });

  it('updates an existing site', async () => {
    const siteToUpdate = await dataAccess.getSiteByBaseURL('https://example1.com');
    const originalUpdatedAt = siteToUpdate.getUpdatedAt();
    const newDeliveryType = 'aem_cs';
    const newGitHubURL = 'https://github.com/newOrg/some-repo';
    const newOrgId = 'updatedOrg123';

    await sleep(10); // Make sure updatedAt is different

    siteToUpdate.updateDeliveryType(newDeliveryType);
    siteToUpdate.updateGitHubURL(newGitHubURL);
    siteToUpdate.updateOrganizationId(newOrgId);
    siteToUpdate.toggleLive();

    const updatedSite = await dataAccess.updateSite(siteToUpdate);

    expect(updatedSite.getDeliveryType()).to.equal(newDeliveryType);
    expect(updatedSite.getGitHubURL()).to.equal(newGitHubURL);
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

  it('updates audit configurations for a site', async () => {
    const siteToUpdate = await dataAccess.getSiteByBaseURL('https://example2.com');

    // Update all audits to be disabled
    siteToUpdate.setAllAuditsDisabled(true);
    await dataAccess.updateSite(siteToUpdate);

    let updatedSite = await dataAccess.getSiteByID(siteToUpdate.getId());
    expect(updatedSite.getAuditConfig().auditsDisabled()).to.be.true;

    // Update a specific audit type configuration
    siteToUpdate.updateAuditTypeConfig('type1', { disabled: false });
    await dataAccess.updateSite(siteToUpdate);

    updatedSite = await dataAccess.getSiteByID(siteToUpdate.getId());
    expect(updatedSite.getAuditConfig().getAuditTypeConfig('type1').disabled()).to.be.false;
  });
});
