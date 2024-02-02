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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { siteCandidateFunctions } from '../../../../src/service/site-candidates/index.js';
import { createSiteCandidate, SITE_CANDIDATE_STATUS } from '../../../../src/models/site-candidate.js';

chai.use(chaiAsPromised);
chai.use(sinonChai);

const { expect } = chai;

const TEST_DA_CONFIG = {
  tableNameAudits: 'test-audits',
  tableNameLatestAudits: 'test-latest-audits',
  tableNameSites: 'test-sites',
  tableNameSiteCandidates: 'test-site-candidates',
  indexNameAllSites: 'test-index-all-sites',
  indexNameAllSitesByDeliveryType: 'test-index-all-sites-by-delivery-type',
  indexNameAllSitesOrganizations: 'test-index-all-sites-organizations',
  indexNameAllLatestAuditScores: 'test-index-all-latest-audit-scores',
  pkAllSites: 'test-pk-all-sites',
  pkAllLatestAudits: 'test-pk-all-latest-audits',
};

describe('Site Candidate Access Pattern Tests', () => {
  describe('Site Candidate Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = siteCandidateFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports upsertSiteCandidate function', () => {
      expect(exportedFunctions).to.have.property('upsertSiteCandidate');
      expect(exportedFunctions.upsertSiteCandidate).to.be.a('function');
    });

    it('exports siteCandidateExists function', () => {
      expect(exportedFunctions).to.have.property('siteCandidateExists');
      expect(exportedFunctions.siteCandidateExists).to.be.a('function');
    });

    it('exports updateSiteCandidate function', () => {
      expect(exportedFunctions).to.have.property('updateSiteCandidate');
      expect(exportedFunctions.updateSiteCandidate).to.be.a('function');
    });
  });

  describe('Site Candidate Functions Tests', () => {
    let mockDynamoClient;
    let mockLog = {};
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve(null)),
        putItem: sinon.stub().returns(Promise.resolve()),
      };

      mockLog = {
        info: sinon.stub().resolves(),
      };

      exportedFunctions = siteCandidateFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('siteCandidateExists returns false when no site candidate exists', async () => {
      const result = await exportedFunctions.siteCandidateExists('test-url');

      expect(result).to.be.false;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('siteCandidateExists returns true when site candidate exists', async () => {
      mockDynamoClient.getItem.returns(Promise.resolve({ baseURL: 'blah' }));

      const result = await exportedFunctions.siteCandidateExists('test-url');

      expect(result).to.be.true;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('upserts a new site candidate successfully', async () => {
      const siteCandidateData = { baseURL: 'https://newsite.com' };

      const result = await exportedFunctions.upsertSiteCandidate(siteCandidateData);

      expect(mockDynamoClient.getItem.calledOnce).to.be.true;
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getBaseURL()).to.equal(siteCandidateData.baseURL);
    });

    it('doesnt add and ignores a new site candidate if already exists before', async () => {
      const siteCandidateData = { baseURL: 'https://newsite.com' };
      mockDynamoClient.getItem.returns(Promise.resolve(siteCandidateData));

      const siteCandidate = await exportedFunctions.upsertSiteCandidate(siteCandidateData);
      expect(siteCandidate.getBaseURL()).to.equal(siteCandidateData.baseURL);
      expect(mockDynamoClient.getItem.calledOnce).to.be.true;
      expect(mockDynamoClient.putItem.notCalled).to.be.true;
      expect(mockLog.info).to.have.been.calledWith('Ignoring the site candidate with base url https://newsite.com because it already exists');
    });

    it('update site candidate throws an error if site candidate exists', async () => {
      mockDynamoClient.getItem.returns(Promise.resolve(null));

      const updatedSiteCandidate = createSiteCandidate({ baseURL: 'https://some-site.com' });

      await expect(exportedFunctions.updateSiteCandidate(updatedSiteCandidate))
        .to.be.rejectedWith('Site candidate with base url https://some-site.com does not exist');
    });

    it('updates an existing site candidate successfully', async () => {
      const siteCandidateData = { baseURL: 'https://existingsite.com', status: SITE_CANDIDATE_STATUS.PENDING };
      mockDynamoClient.getItem.returns(Promise.resolve(siteCandidateData));

      const siteCandidate = createSiteCandidate({ baseURL: 'https://existingsite.com' });
      siteCandidate.setStatus(SITE_CANDIDATE_STATUS.APPROVED);
      siteCandidate.setSiteId('some-site-id');

      const result = await exportedFunctions.updateSiteCandidate(siteCandidate);
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getBaseURL()).to.equal(siteCandidate.getBaseURL());
      expect(result.getSiteId()).to.equal(siteCandidate.getSiteId());
      expect(result.getStatus()).to.equal(siteCandidate.getStatus());
      expect(mockDynamoClient.getItem.calledOnce).to.be.true;
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
    });
  });
});
