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

import { expect } from 'chai';

import dynamoDbLocal from 'dynamo-db-local';
import { isValidUrl } from '@adobe/spacecat-shared-utils';

import { createDataAccess } from '../src/index.js';
import { AUDIT_TYPE_LHS } from '../src/models/audit.js';

import generateSampleData from './generateSampleData.js';

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function checkSite(site) {
  expect(site.getId()).to.be.a('string');
  expect(site.getBaseURL()).to.be.a('string');
  expect(site.getImsOrgId()).to.be.a('string');
  expect(site.getCreatedAt()).to.be.a('string');
  expect(site.getUpdatedAt()).to.be.a('string');
  expect(site.getAudits()).to.be.an('array');
}

describe('DynamoDB Integration Test', async () => {
  let dynamoDbLocalProcess;
  let dataAccess;

  const NUMBER_OF_SITES = 10;
  const NUMBER_OF_AUDITS_PER_SITE = 3;

  before(async function () {
    this.timeout(3000);

    process.env.AWS_REGION = 'local';

    dynamoDbLocalProcess = dynamoDbLocal.spawn({ port: 8000, sharedDb: true });

    await sleep(500);

    await generateSampleData(NUMBER_OF_SITES, NUMBER_OF_AUDITS_PER_SITE);

    dataAccess = createDataAccess(console);
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
    const sites = await dataAccess.getSitesWithLatestAudit(AUDIT_TYPE_LHS);

    // Every tenth site will not have any audits
    expect(sites.length).to.equal(NUMBER_OF_SITES - 1);

    sites.forEach((site) => {
      checkSite(site);
      expect(site.getAudits()).to.be.an('array').that.has.lengthOf(1);
      site.getAudits().forEach((audit) => {
        expect(audit.getAuditType()).to.equal(AUDIT_TYPE_LHS);
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
});
