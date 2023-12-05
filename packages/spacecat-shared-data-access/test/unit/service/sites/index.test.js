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
import sinon from 'sinon';

import { siteFunctions } from '../../../../src/service/sites/index.js';
import { createSite } from '../../../../src/models/site.js';

chai.use(chaiAsPromised);

const { expect } = chai;

const TEST_DA_CONFIG = {
  tableNameAudits: 'test-audits',
  tableNameLatestAudits: 'test-latest-audits',
  tableNameSites: 'test-sites',
  indexNameAllSites: 'test-index-all-sites',
  indexNameAllLatestAuditScores: 'test-index-all-latest-audit-scores',
  pkAllSites: 'test-pk-all-sites',
  pkAllLatestAudits: 'test-pk-all-latest-audits',
};

describe('Site Access Pattern Tests', () => {
  describe('Site Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = siteFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports getSites function', () => {
      expect(exportedFunctions).to.have.property('getSites');
      expect(exportedFunctions.getSites).to.be.a('function');
    });

    it('exports getSitesToAudit function', () => {
      expect(exportedFunctions).to.have.property('getSitesToAudit');
      expect(exportedFunctions.getSitesToAudit).to.be.a('function');
    });

    it('exports getSitesWithLatestAudit function', () => {
      expect(exportedFunctions).to.have.property('getSitesWithLatestAudit');
      expect(exportedFunctions.getSitesWithLatestAudit).to.be.a('function');
    });

    it('exports getSiteByBaseURL function', () => {
      expect(exportedFunctions).to.have.property('getSiteByBaseURL');
      expect(exportedFunctions.getSiteByBaseURL).to.be.a('function');
    });

    it('exports getSiteByBaseURLWithAuditInfo function', () => {
      expect(exportedFunctions).to.have.property('getSiteByBaseURLWithAuditInfo');
      expect(exportedFunctions.getSiteByBaseURLWithAuditInfo).to.be.a('function');
    });

    it('exports getSiteByBaseURLWithAudits function', () => {
      expect(exportedFunctions).to.have.property('getSiteByBaseURLWithAudits');
      expect(exportedFunctions.getSiteByBaseURLWithAudits).to.be.a('function');
    });

    it('exports getSiteByBaseURLWithLatestAudit function', () => {
      expect(exportedFunctions).to.have.property('getSiteByBaseURLWithLatestAudit');
      expect(exportedFunctions.getSiteByBaseURLWithLatestAudit).to.be.a('function');
    });
  });

  describe('Site Functions Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        getItem: sinon.stub().returns(Promise.resolve(null)),
      };
      mockLog = { log: sinon.stub() };

      exportedFunctions = siteFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('calls getSites and returns an array', async () => {
      const result = await exportedFunctions.getSites();
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesToAudit and returns an array', async () => {
      const result = await exportedFunctions.getSitesToAudit();
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesWithLatestAudit and returns an array', async () => {
      const result = await exportedFunctions.getSitesWithLatestAudit();
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesWithLatestAudit and handles latestAudits', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseURL: 'https://example.com',
      }];

      const mockAuditData = [{
        siteId: 'site1',
        auditType: 'lhs-mobile',
        auditedAt: new Date().toISOString(),
        auditResult: {
          scores: {
            performance: 0.9,
            seo: 0.9,
            accessibility: 0.9,
            'best-practices': 0.9,
          },
        },
        fullAuditRef: 'https://example.com',
      }];

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onSecondCall().resolves(mockAuditData);

      const result = await exportedFunctions.getSitesWithLatestAudit('lhs-mobile');
      expect(result).to.be.an('array').that.has.lengthOf(1);
    });

    it('calls getSitesWithLatestAudit and handles empty latestAudits', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseURL: 'https://example.com',
      }];

      const mockAuditData = [];

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onSecondCall().resolves(mockAuditData);

      const result = await exportedFunctions.getSitesWithLatestAudit('auditType');
      expect(result).to.be.an('array').that.is.empty;
    });

    it('calls getSiteByBaseURL and returns null', async () => {
      const result = await exportedFunctions.getSiteByBaseURL();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSiteByID and returns null', async () => {
      const result = await exportedFunctions.getSiteByID();
      expect(result).to.be.null;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getSiteByID and returns site', async () => {
      const mockSiteData = {
        id: 'site1',
        baseURL: 'https://example.com',
      };

      mockDynamoClient.getItem.onFirstCall().resolves(mockSiteData);

      const result = await exportedFunctions.getSiteByID();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockSiteData.id);
      expect(result.getBaseURL()).to.equal(mockSiteData.baseURL);
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithAuditInfo and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithAuditInfo and returns null when site is undefined', async () => {
      mockDynamoClient.query.resolves([]);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('baseUrl', 'auditType');
      expect(result).to.be.null;
    });

    it('calls getSiteByBaseURLWithAuditInfo and assigns latest audit when latestOnly is true', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseURL: 'https://example.com',
      }];

      const mockLatestAuditData = {
        siteId: 'site1',
        auditType: 'lhs-mobile',
        auditedAt: new Date().toISOString(),
        auditResult: {
          scores: {
            performance: 0.9,
            seo: 0.9,
            accessibility: 0.9,
            'best-practices': 0.9,
          },
        },
        fullAuditRef: 'https://example.com',
      };

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.getItem.onFirstCall().resolves(mockLatestAuditData);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('https://example.com', 'lhs-mobile', true);
      const audits = result.getAudits();
      expect(audits).to.be.an('array').with.lengthOf(1);

      const audit = audits[0];
      expect(audit.getId()).to.be.a('string').that.is.not.empty;
      expect(audit.getSiteId()).to.equal(mockLatestAuditData.siteId);
      expect(audit.getAuditType()).to.equal(mockLatestAuditData.auditType);
      expect(audit.getAuditedAt()).to.equal(mockLatestAuditData.auditedAt);
      expect(audit.getAuditResult()).to.deep.equal(mockLatestAuditData.auditResult);
      expect(audit.getFullAuditRef()).to.equal(mockLatestAuditData.fullAuditRef);
    });

    it('calls getSiteByBaseURLWithAuditInfo and assigns all audits when latestOnly is false', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseURL: 'https://example.com',
      }];

      const mockLatestAuditData = [{
        siteId: 'site1',
        auditType: 'lhs-mobile',
        auditedAt: new Date().toISOString(),
        auditResult: {
          scores: {
            performance: 0.9,
            seo: 0.9,
            accessibility: 0.9,
            'best-practices': 0.9,
          },
        },
        fullAuditRef: 'https://example.com',
      },
      {
        siteId: 'site1',
        auditType: 'lhs-mobile',
        auditedAt: new Date().toISOString(),
        auditResult: {
          scores: {
            performance: 0.9,
            seo: 0.9,
            accessibility: 0.9,
            'best-practices': 0.9,
          },
        },
        fullAuditRef: 'https://example2.com',
      }];

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onSecondCall().resolves(mockLatestAuditData);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('baseUrl', 'lhs-mobile', false);
      const audits = result.getAudits();
      expect(audits).to.be.an('array').with.lengthOf(2);

      for (let i = 0; i < mockLatestAuditData.length; i += 1) {
        const mockAudit = mockLatestAuditData[i];
        const audit = audits[i];

        expect(audit.getId()).to.be.a('string').that.is.not.empty;
        expect(audit.getSiteId()).to.equal(mockAudit.siteId);
        expect(audit.getAuditType()).to.equal(mockAudit.auditType);
        expect(audit.getAuditedAt()).to.equal(mockAudit.auditedAt);
        expect(audit.getAuditResult()).to.deep.equal(mockAudit.auditResult);
        expect(audit.getFullAuditRef()).to.equal(mockAudit.fullAuditRef);
      }
    });

    it('calls getSiteByBaseURLWithAudits and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithAudits();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithLatestAudit and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithLatestAudit();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    describe('addSite Tests', () => {
      beforeEach(() => {
        mockDynamoClient = {
          query: sinon.stub().returns(Promise.resolve([])),
          putItem: sinon.stub().returns(Promise.resolve()),
        };
        mockLog = { log: sinon.stub() };
        exportedFunctions = siteFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
      });

      it('adds a new site successfully', async () => {
        const siteData = { baseURL: 'https://newsite.com' };
        const result = await exportedFunctions.addSite(siteData);
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
        expect(result.getBaseURL()).to.equal(siteData.baseURL);
        expect(result.getId()).to.be.a('string');
        expect(result.getAudits()).to.be.an('array').that.is.empty;
      });

      it('throws an error if site already exists', async () => {
        const siteData = { baseURL: 'https://existingsite.com' };
        mockDynamoClient.query.returns(Promise.resolve([siteData]));

        await expect(exportedFunctions.addSite(siteData)).to.be.rejectedWith('Site already exists');
      });
    });
  });

  describe('updateSite Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        putItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = { log: sinon.stub() };
      exportedFunctions = siteFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('updates an existing site successfully', async () => {
      const siteData = { baseURL: 'https://existingsite.com' };
      mockDynamoClient.query.returns(Promise.resolve([siteData]));

      const site = await exportedFunctions.getSiteByBaseURL(siteData.baseURL);
      // site.updateBaseURL('https://newsite.com');
      site.updateImsOrgId('newOrg123');

      const result = await exportedFunctions.updateSite(site);
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getBaseURL()).to.equal(site.getBaseURL());
      expect(result.getImsOrgId()).to.equal(site.getImsOrgId());
    });

    it('throws an error if site does not exist', async () => {
      const site = createSite({ baseURL: 'https://nonexistingsite.com' });
      await expect(exportedFunctions.updateSite(site)).to.be.rejectedWith('Site not found');
    });
  });

  describe('removeSite Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        removeItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = {
        log: sinon.stub(),
        error: sinon.stub(),
      };
      exportedFunctions = siteFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('removes the site and its related audits', async () => {
      await exportedFunctions.removeSite('some-id');

      expect(mockDynamoClient.removeItem.calledOnce).to.be.true;
    });

    it('logs an error and reject if the site removal fails', async () => {
      const errorMessage = 'Failed to delete site';
      mockDynamoClient.removeItem.rejects(new Error(errorMessage));

      await expect(exportedFunctions.removeSite('some-id')).to.be.rejectedWith(errorMessage);
      expect(mockLog.error.calledOnce).to.be.true;
    });
  });
});
