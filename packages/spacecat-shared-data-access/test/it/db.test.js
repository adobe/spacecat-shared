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

import { isIsoDate, isValidUrl } from '@adobe/spacecat-shared-utils';
import { sleep } from '../unit/util.js';
import { createDataAccess } from '../../src/service/index.js';
import { AUDIT_TYPE_LHS_MOBILE } from '../../src/models/audit.js';

import generateSampleData from './generateSampleData.js';

const { expect } = chai;
chai.use(chaiAsPromised);

function checkSite(site) {
  expect(site).to.be.an('object');
  expect(site.getId()).to.be.a('string');
  expect(site.getBaseURL()).to.be.a('string');
  expect(site.getGitHubURL()).to.be.a('string');
  expect(site.getImsOrgId()).to.be.a('string');
  expect(isIsoDate(site.getCreatedAt())).to.be.true;
  expect(isIsoDate(site.getUpdatedAt())).to.be.true;
  expect(site.getAudits()).to.be.an('array');
  expect(site.isLive()).to.be.a('boolean');
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
  tableNameSites: 'spacecat-services-sites',
  indexNameAllSites: 'spacecat-services-all-sites',
  indexNameAllLatestAuditScores: 'spacecat-services-all-latest-audit-scores',
  pkAllSites: 'ALL_SITES',
  pkAllLatestAudits: 'ALL_LATEST_AUDITS',
};

describe('DynamoDB Integration Test', async () => {
  let dynamoDbLocalProcess;
  let dataAccess;

  const NUMBER_OF_SITES = 10;
  const NUMBER_OF_AUDITS_PER_TYPE_AND_SITE = 3;

  before(async function () {
    this.timeout(20000);

    process.env.AWS_REGION = 'local';
    process.env.AWS_DEFAULT_REGION = 'local';
    process.env.AWS_ACCESS_KEY_ID = 'dummy';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy';

    dynamoDbLocalProcess = dynamoDbLocal.spawn({ port: 8000, sharedDb: true });

    await sleep(1000); // give db time to start up

    await generateSampleData(TEST_DA_CONFIG, NUMBER_OF_SITES, NUMBER_OF_AUDITS_PER_TYPE_AND_SITE);

    dataAccess = createDataAccess(TEST_DA_CONFIG, console);
  });

  after(() => {
    dynamoDbLocalProcess.kill();
  });

  it('gets sites', async () => {
    const sites = await dataAccess.getSites();

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((site) => {
      checkSite(site);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(0);
    });
  });

  it('gets sites to audit', async () => {
    const sites = await dataAccess.getSitesToAudit();

    expect(sites.length).to.equal(NUMBER_OF_SITES);

    sites.forEach((baseURL) => {
      expect(baseURL).to.be.a('string');
      expect(isValidUrl(baseURL)).to.equal(true);
    });
  });

  it('gets sites with latest audit', async () => {
    const sites = await dataAccess.getSitesWithLatestAudit(AUDIT_TYPE_LHS_MOBILE);

    // Every tenth site will not have any audits
    expect(sites.length).to.equal(NUMBER_OF_SITES - 1);

    sites.forEach((site) => {
      checkSite(site);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(1);
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

  it('adds a new site', async () => {
    const newSiteData = {
      baseURL: 'https://newexample.com',
      gitHubURL: 'https://github.com/some-org/test-repo',
      imsOrgId: 'newOrg123',
      audits: [],
    };

    const addedSite = await dataAccess.addSite(newSiteData);

    expect(addedSite).to.be.an('object');

    const newSite = await dataAccess.getSiteByBaseURL(newSiteData.baseURL);

    checkSite(newSite);

    expect(newSite.getId()).to.to.be.a('string');
    expect(newSite.getBaseURL()).to.equal(newSiteData.baseURL);
    expect(newSite.getGitHubURL()).to.equal(newSiteData.gitHubURL);
    expect(newSite.getImsOrgId()).to.equal(newSiteData.imsOrgId);
    expect(newSite.getAudits()).to.be.an('array').that.is.empty;
  });

  it('updates an existing site', async () => {
    const siteToUpdate = await dataAccess.getSiteByBaseURL('https://example1.com');
    const originalUpdatedAt = siteToUpdate.getUpdatedAt();
    const newImsOrgId = 'updatedOrg123';

    await sleep(10); // Make sure updatedAt is different

    siteToUpdate.updateImsOrgId(newImsOrgId);

    const updatedSite = await dataAccess.updateSite(siteToUpdate);

    expect(updatedSite.getImsOrgId()).to.equal(newImsOrgId);
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
        performance: 0,
        seo: 0,
        accessibility: 0,
        'best-practices': 0,
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
  });

  it('throws an error when adding a duplicate audit', async () => {
    const auditData = {
      siteId: 'https://example1.com',
      auditType: AUDIT_TYPE_LHS_MOBILE,
      auditedAt: new Date().toISOString(),
      fullAuditRef: 's3://ref',
      isLive: true,
      auditResult: {
        performance: 0,
        seo: 0,
        accessibility: 0,
        'best-practices': 0,
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
});
