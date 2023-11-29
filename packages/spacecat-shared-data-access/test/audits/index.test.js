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
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getLatestAudits and return an array', async () => {
      const result = await exportedFunctions.getLatestAudits('auditType', true);
      expect(result).to.be.an('array');
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getLatestAuditForSite and return an array', async () => {
      const result = await exportedFunctions.getLatestAuditForSite('siteId', 'auditType');
      // eslint-disable-next-line no-unused-expressions
      expect(result).to.be.null;
      // eslint-disable-next-line no-unused-expressions
      expect(mockDynamoClient.query.called).to.be.true;
    });
  });
});
