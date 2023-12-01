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

import { auditFunctions } from '../../../../src/service/audits/index.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('Audit Access Pattern Tests', () => {
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
        removeItem: sinon.stub().resolves(),
      };
      mockLog = {
        log: sinon.stub(),
        error: sinon.stub(),
      };

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
        auditType: 'lhs',
        auditedAt: new Date().toISOString(),
        auditResult: {
          performance: 0.9,
          seo: 0.9,
          accessibility: 0.9,
          'best-practices': 0.9,
        },
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
      auditResult: {
        performance: 0.9,
        seo: 0.9,
        accessibility: 0.9,
        'best-practices': 0.9,
      },
      fullAuditRef: 'https://someurl.com',
    };

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        putItem: sinon.stub().returns(Promise.resolve()),
        removeItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = {
        log: sinon.stub(),
        error: sinon.stub(),
      };
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

    it('throws an error for unknown audit type', async () => {
      const invalidAuditData = {
        ...auditData,
        auditType: 'unknownType', // An unknown audit type
      };

      await expect(exportedFunctions.addAudit(invalidAuditData)).to.be.rejectedWith('Unknown audit type');
    });

    it('throws an error if an expected property is missing in audit results', async () => {
      const incompleteAuditData = {
        ...auditData,
        auditResult: {
          performance: 0.9,
          seo: 0.9,
          // 'accessibility' and 'best-practices' are missing
        },
      };

      await expect(exportedFunctions.addAudit(incompleteAuditData)).to.be.rejectedWith('Missing expected property');
    });

    it('should remove all audits and latest audits for a site', async () => {
      const mockAuditData = [{
        siteId: 'siteId',
        auditType: 'lhs',
        auditedAt: new Date().toISOString(),
        auditResult: {
          performance: 0.9,
          seo: 0.9,
          accessibility: 0.9,
          'best-practices': 0.9,
        },
        fullAuditRef: 'https://someurl.com',
      }];
      mockDynamoClient.query.returns(Promise.resolve(mockAuditData));

      await exportedFunctions.removeAuditsForSite('test-id');

      expect(mockDynamoClient.query.calledTwice).to.be.true;
      expect(mockDynamoClient.removeItem.calledTwice).to.be.true;
    });

    it('should log an error if the removal fails', async () => {
      const mockAuditData = [{
        siteId: 'siteId',
        auditType: 'lhs',
        auditedAt: new Date().toISOString(),
        auditResult: {
          performance: 0.9,
          seo: 0.9,
          accessibility: 0.9,
          'best-practices': 0.9,
        },
        fullAuditRef: 'https://someurl.com',
      }];
      mockDynamoClient.query.returns(Promise.resolve(mockAuditData));

      const errorMessage = 'Failed to delete item';
      mockDynamoClient.removeItem.rejects(new Error(errorMessage));

      await expect(exportedFunctions.removeAuditsForSite('some-id')).to.be.rejectedWith(errorMessage);
    });
  });
});
