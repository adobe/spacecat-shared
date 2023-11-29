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
import sinon from 'sinon';

import { siteFunctions } from '../../src/sites/index.js';

describe('Site Index Tests', () => {
  describe('Site Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = siteFunctions(mockDynamoClient, mockLog);

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

      exportedFunctions = siteFunctions(mockDynamoClient, mockLog);
    });

    it('calls getSites and returns an array', async () => {
      const result = await exportedFunctions.getSites();
      expect(result).to.be.an('array');
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesToAudit and returns an array', async () => {
      const result = await exportedFunctions.getSitesToAudit();
      expect(result).to.be.an('array');
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesWithLatestAudit and returns an array', async () => {
      const result = await exportedFunctions.getSitesWithLatestAudit();
      expect(result).to.be.an('array');
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getSitesWithLatestAudit and handles latestAudits', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseUrl: 'https://example.com',
      }];

      const mockAuditData = [{
        id: 'audit1',
        siteId: 'site1',
        auditType: 'type1',
      }];

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onSecondCall().resolves(mockAuditData);

      const result = await exportedFunctions.getSitesWithLatestAudit('auditType');
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.an('array').that.has.lengthOf(1);
    });

    it('calls getSitesWithLatestAudit and handles empty latestAudits', async () => {
      const mockSiteData = [{
        id: 'site1',
        baseUrl: 'https://example.com',
      }];

      const mockAuditData = [];

      mockDynamoClient.query.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onSecondCall().resolves(mockAuditData);

      const result = await exportedFunctions.getSitesWithLatestAudit('auditType');
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.an('array').that.is.empty;
    });

    it('calls getSiteByBaseURL and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURL();
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithAuditInfo and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo();
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithAuditInfo and returns null when site is undefined', async () => {
      mockDynamoClient.query.resolves(undefined);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('baseUrl', 'auditType');
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
    });

    it('calls getSiteByBaseURLWithAuditInfo and assigns latest audit when latestOnly is true', async () => {
      const mockSiteData = {
        id: 'site1',
        baseUrl: 'https://example.com',
      };

      const mockLatestAuditData = [{
        id: 'audit1',
        siteId: 'site1',
        auditType: 'type1',
      }];

      mockDynamoClient.getItem.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onFirstCall().resolves(mockLatestAuditData);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('https://example.com', 'type1', true);
      expect(result).to.have.property('audits').that.is.an('array').with.lengthOf(1);
      expect(result.audits[0]).to.deep.equal(mockLatestAuditData[0]);
    });

    it('calls getSiteByBaseURLWithAuditInfo and assigns all audits when latestOnly is false', async () => {
      const mockSiteData = {
        id: 'site1',
        baseUrl: 'https://example.com',
      };

      const mockLatestAuditData = [{
        id: 'audit1',
        siteId: 'site1',
        auditType: 'type1',
      }];

      mockDynamoClient.getItem.onFirstCall().resolves(mockSiteData);
      mockDynamoClient.query.onFirstCall().resolves(mockLatestAuditData);

      const result = await exportedFunctions.getSiteByBaseURLWithAuditInfo('baseUrl', 'auditType', false);
      expect(result).to.have.property('audits').that.is.an('array');
    });

    it('calls getSiteByBaseURLWithAudits and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithAudits();
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getSiteByBaseURLWithLatestAudit and returns an array/object', async () => {
      const result = await exportedFunctions.getSiteByBaseURLWithLatestAudit();
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.getItem.called).to.be.true;
    });
  });
});
