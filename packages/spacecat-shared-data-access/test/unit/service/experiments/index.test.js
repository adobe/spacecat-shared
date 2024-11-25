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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { experimentFunctions } from '../../../../src/service/experiments/index.js';
import { createExperiment } from '../../../../src/models/experiment.js';

use(chaiAsPromised);
use(sinonChai);

const TEST_DA_CONFIG = {
  tableNameAudits: 'test-audits',
  tableNameLatestAudits: 'test-latest-audits',
  tableNameSites: 'test-sites',
  tableNameExperiments: 'test-experiments',
  tableNameSiteCandidates: 'test-site-candidates',
  indexNameAllSites: 'test-index-all-sites',
  indexNameAllSitesByDeliveryType: 'test-index-all-sites-by-delivery-type',
  indexNameAllSitesOrganizations: 'test-index-all-sites-organizations',
  indexNameAllLatestAuditScores: 'test-index-all-latest-audit-scores',
  pkAllSites: 'test-pk-all-sites',
  pkAllLatestAudits: 'test-pk-all-latest-audits',
};

describe('Experiments Access Pattern Tests', () => {
  describe('Experiments Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = experimentFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports getExperiments function', () => {
      expect(exportedFunctions).to.have.property('getExperiments');
      expect(exportedFunctions.getExperiments).to.be.a('function');
    });

    it('exports getExperiment function', () => {
      expect(exportedFunctions).to.have.property('getExperiment');
      expect(exportedFunctions.getExperiment).to.be.a('function');
    });

    it('exports upsertExperiment function', () => {
      expect(exportedFunctions).to.have.property('upsertExperiment');
      expect(exportedFunctions.upsertExperiment).to.be.a('function');
    });
    it('exports removeExperimentsForSite function', () => {
      expect(exportedFunctions).to.have.property('removeExperimentsForSite');
      expect(exportedFunctions.removeExperimentsForSite).to.be.a('function');
    });
  });

  describe('Experiments Functions Tests', () => {
    let mockDynamoClient;
    let mockLog = {};
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve(null)),
        putItem: sinon.stub().returns(Promise.resolve()),
        removeItem: sinon.stub().returns(Promise.resolve()),
        query: sinon.stub().returns(Promise.resolve(null)),
      };

      mockLog = {
        info: sinon.stub().resolves(),
        error: sinon.stub().resolves(),
      };

      exportedFunctions = experimentFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('returns the experiment if it exists', async () => {
      const experimentData = {
        siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
        experimentId: 'experiment-test',
        name: 'Experiment Test',
        url: 'https://example0.com/page-1',
        status: 'active',
        type: 'full',
        variants: [],
        startDate: new Date().toISOString(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'unit-test',
        conversionEventName: 'convert',
        conversionEventValue: 'addToCart',
      };
      mockDynamoClient.query.returns(Promise.resolve([experimentData]));

      const result = await exportedFunctions.getExperiment('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f', 'experiment-test', 'https://example0.com/page-1');

      expect(result.getExperimentId()).to.equal(experimentData.experimentId);
      expect(result.getStatus()).to.equal(experimentData.status);
      expect(result.getSiteId()).to.equal(experimentData.siteId);
    });

    it('returns null if the experiment does not exist', async () => {
      mockDynamoClient.getItem.returns(Promise.resolve(null));

      const result = await exportedFunctions.getExperiment('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f', 'experiment-test', 'https://example0.com/page-1');

      expect(result).to.equal(null);
    });

    it('returns all the experiments for the given siteId', async () => {
      const experiments = [];
      for (let i = 0; i < 3; i += 1) {
        experiments.push({
          siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
          experimentId: `experiment-${i}`,
          name: `Experiment ${i}`,
          url: `https://example0.com/page-${i}`,
          status: 'active',
          type: 'full',
          variants: [],
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'unit-test',
          conversionEventName: 'convert',
          conversionEventValue: 'addToCart',
        });
      }
      mockDynamoClient.query.returns(Promise.resolve(experiments));

      const result = await exportedFunctions.getExperiments('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f');

      expect(result.length).to.equal(3);
    });

    it('returns all the experiments for the given siteId and experimentId', async () => {
      const experiments = [];
      for (let i = 0; i < 3; i += 1) {
        experiments.push({
          siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
          experimentId: 'experiment-summer-2024',
          name: 'Experiment Summer 2024',
          url: `https://example0.com/page-${i}`,
          status: 'active',
          type: 'full',
          variants: [],
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'unit-test',
          conversionEventName: 'convert',
          conversionEventValue: 'addToCart',
        });
      }
      mockDynamoClient.query.returns(Promise.resolve(experiments));

      const result = await exportedFunctions.getExperiments('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f', 'experiment-summer-2024');

      expect(result.length).to.equal(3);
    });

    it('updates the existing experiment successfully', async () => {
      const experimentData = {
        siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
        experimentId: 'experiment-test',
        name: 'Experiment Test',
        url: 'https://example0.com/page-1',
        status: 'active',
        type: 'full',
        variants: [],
        startDate: new Date().toISOString(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'unit-test',
        conversionEventName: 'convert',
        conversionEventValue: 'addToCart',
      };
      mockDynamoClient.query.returns(Promise.resolve(experimentData));

      const experiment = createExperiment(experimentData);

      const result = await exportedFunctions.upsertExperiment(experimentData);
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getSiteId()).to.equal(experiment.getSiteId());
      expect(result.getExperimentId()).to.equal(experiment.getExperimentId());
    });

    it('removes all experiments for a site', async () => {
      const experiments = [];
      for (let i = 0; i < 3; i += 1) {
        experiments.push({
          siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
          experimentId: `experiment-${i}`,
          name: `Experiment ${i}`,
          url: `https://example0.com/page-${i}`,
          status: 'active',
          type: 'full',
          variants: [],
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'unit-test',
          conversionEventName: 'convert',
          conversionEventValue: 'addToCart',
        });
      }
      mockDynamoClient.query.returns(Promise.resolve(experiments));

      await exportedFunctions.removeExperimentsForSite('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockDynamoClient.removeItem.callCount).to.equal(experiments.length);
      expect(mockLog.error.called).to.be.false;
    });

    it('logs an error if there is an error getting experiments for a site while removing', async () => {
      mockDynamoClient.query.returns(Promise.reject(new Error('Error removing experiments')));

      await expect(exportedFunctions.removeExperimentsForSite('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f')).to.be.rejectedWith('Error removing experiments');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockLog.error.calledOnce).to.be.true;
    });

    it('logs an error if there is an error removing experiments', async () => {
      const experiments = [];
      for (let i = 0; i < 3; i += 1) {
        experiments.push({
          siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
          experimentId: `experiment-${i}`,
          name: `Experiment ${i}`,
          url: `https://example0.com/page-${i}`,
          status: 'active',
          type: 'full',
          variants: [],
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'unit-test',
          conversionEventName: 'convert',
          conversionEventValue: 'addToCart',
        });
      }
      mockDynamoClient.query.returns(Promise.resolve(experiments));
      mockDynamoClient.removeItem.returns(Promise.reject(new Error('Error removing experiments')));

      await expect(exportedFunctions.removeExperimentsForSite('a48b583f-53f6-4250-b0a4-5a1ae5ccb38f')).to.be.rejectedWith('Error removing experiments');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockDynamoClient.removeItem.callCount).to.equal(experiments.length);
      expect(mockLog.error.calledOnce).to.be.true;
    });
  });
});
