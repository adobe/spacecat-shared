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

import { auditFunctions } from '../../src/audits/index.js';

describe('Audit Index Tests', () => {
  describe('Audit Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = auditFunctions(mockDynamoClient, mockLog);

    it('exports getAuditsForSite function', () => {
      expect(exportedFunctions).to.have.property('getAuditsForSite');
      expect(exportedFunctions.getAuditsForSite).to.be.a('function');
    });

    it('exports getLatestAudits function', () => {
      expect(exportedFunctions).to.have.property('getLatestAudits');
      expect(exportedFunctions.getLatestAudits).to.be.a('function');
    });

    it('exports getLatestAuditForSite function', () => {
      expect(exportedFunctions).to.have.property('getLatestAuditForSite');
      expect(exportedFunctions.getLatestAuditForSite).to.be.a('function');
    });
  });

  describe('Audit Functions Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
      };
      mockLog = { log: sinon.stub() };

      exportedFunctions = auditFunctions(mockDynamoClient, mockLog);
    });

    it('calls getAuditsForSite and return an array', async () => {
      const result = await exportedFunctions.getAuditsForSite('siteId', 'auditType');
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getLatestAudits and return an array', async () => {
      const result = await exportedFunctions.getLatestAudits('auditType', true);
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getLatestAuditForSite and return an array', async () => {
      const result = await exportedFunctions.getLatestAuditForSite('siteId', 'auditType');
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });
  });

  describe('getAuditForSite Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
      };
      mockLog = { log: sinon.stub() };
      exportedFunctions = auditFunctions(mockDynamoClient, mockLog);
    });

    it('successfully retrieves an audit for a site', async () => {
      const mockAuditData = [{
        siteId: 'siteId',
        auditType: 'type1',
        auditedAt: new Date().toISOString(),
        auditResult: { score: 1 },
        fullAuditRef: 'https://someurl.com',
      }];
      mockDynamoClient.query.returns(Promise.resolve(mockAuditData));

      const result = await exportedFunctions.getAuditForSite('siteId', 'auditType', 'auditedAt');
      expect(result).to.not.be.null;
      expect(result.getScores()).to.be.an('object');
      expect(mockDynamoClient.query.calledOnce).to.be.true;
    });

    it('returns null if no audit is found for a site', async () => {
      mockDynamoClient.query.returns(Promise.resolve([]));

      const result = await exportedFunctions.getAuditForSite('siteId', 'auditType', 'auditedAt');
      expect(result).to.be.null;
      expect(mockDynamoClient.query.calledOnce).to.be.true;
    });
  });

  describe('addAudit Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    const auditData = {
      siteId: 'siteId',
      auditType: 'lhs',
      auditedAt: new Date().toISOString(),
      auditResult: { score: 1 },
      fullAuditRef: 'https://someurl.com',
    };

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        putItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = { log: sinon.stub() };
      exportedFunctions = auditFunctions(mockDynamoClient, mockLog);
    });

    it('successfully adds a new audit', async () => {
      const result = await exportedFunctions.addAudit(auditData);
      // Once for 'audits' and once for 'latest_audits'
      expect(mockDynamoClient.putItem.calledTwice).to.be.true;
      expect(result.getSiteId()).to.equal(auditData.siteId);
      expect(result.getAuditType()).to.equal(auditData.auditType);
      expect(result.getAuditedAt()).to.equal(auditData.auditedAt);
      expect(result.getAuditResult()).to.deep.equal(auditData.auditResult);
      expect(result.getFullAuditRef()).to.equal(auditData.fullAuditRef);
      expect(result.getScores()).to.be.an('object');
    });

    it('throws an error if audit already exists', async () => {
      mockDynamoClient.query.returns(Promise.resolve([auditData]));

      await expect(exportedFunctions.addAudit(auditData)).to.be.rejectedWith('Audit already exists');
    });
  });
});
