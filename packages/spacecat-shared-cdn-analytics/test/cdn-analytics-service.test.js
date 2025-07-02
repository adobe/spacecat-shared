/*
 * Copyright 2025 Adobe. All rights reserved.
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
import esmock from 'esmock';
import {
  createMockContext,
  createMockSite,
  createServiceMocks,
} from './test-helpers.js';

use(chaiAsPromised);
use(sinonChai);

describe('CdnAnalyticsService', () => {
  let CdnAnalyticsService;
  let context;
  let site;
  let serviceMocks;

  before(async () => {
    serviceMocks = await createServiceMocks();

    const module = await esmock('../src/cdn-analytics-service.js', serviceMocks.mocks);
    CdnAnalyticsService = module.CdnAnalyticsService;
  });

  beforeEach(() => {
    context = createMockContext();
    site = createMockSite();
    sinon.resetHistory();
  });

  afterEach(() => {
    sinon.resetHistory();
  });

  describe('constructor', () => {
    it('creates service with context and site', () => {
      const service = new CdnAnalyticsService(context, site);
      expect(service.context).to.equal(context);
      expect(service.site).to.equal(site);
      expect(service.s3Config).to.not.be.null;
      expect(service.athenaClient).to.be.undefined;
    });

    it('creates service without site', () => {
      const service = new CdnAnalyticsService(context);
      expect(service.context).to.equal(context);
      expect(service.site).to.be.null;
      expect(service.s3Config).to.be.null;
    });
  });

  describe('initialization', () => {
    it('throws error if no site is provided when executing template', async () => {
      const service = new CdnAnalyticsService(context);
      await expect(service.executeTemplate('test-template')).to.be.rejectedWith('Site is required for CDN analytics');
    });
  });

  describe('executeTemplate', () => {
    let service;

    beforeEach(() => {
      service = new CdnAnalyticsService(context, site);
    });

    it('executes template successfully', async () => {
      const mockResults = [
        { user_agent: 'GoogleBot', total_requests: '1000' },
        { user_agent: 'BingBot', total_requests: '500' },
      ];

      serviceMocks.mockAthenaClient.query.resolves(mockResults);

      const result = await service.executeTemplate('user-agent-weekly-breakdown', {
        whereClause: 'WHERE week >= \'2025-01-01\'',
        weekColumns: 'SUM(requests) as total_requests',
        orderBy: 'total_requests',
      });

      expect(result).to.deep.include({
        templateName: 'user-agent-weekly-breakdown',
        results: mockResults,
        resultCount: 2,
      });
      expect(result.executedAt).to.be.a('string');
      expect(result.parameters).to.include({
        databaseName: 'test_db',
        tableName: 'test_table',
      });
    });

    it('initializes athena client if not already initialized', async () => {
      serviceMocks.mockAthenaClient.query.resolves([]);
      await service.executeTemplate('test-template');
      expect(service.athenaClient).to.equal(serviceMocks.mockAthenaClient);
    });

    it('handles empty results', async () => {
      serviceMocks.mockAthenaClient.query.resolves([]);
      const result = await service.executeTemplate('test-template');
      expect(result.results).to.deep.equal([]);
      expect(result.resultCount).to.equal(0);
    });

    it('handles null results', async () => {
      serviceMocks.mockAthenaClient.query.resolves(null);
      const result = await service.executeTemplate('test-template');
      expect(result.results).to.be.null;
      expect(result.resultCount).to.equal(0);
    });

    it('throws error on athena query failure', async () => {
      const error = new Error('Athena query failed');
      serviceMocks.mockAthenaClient.query.rejects(error);

      await expect(service.executeTemplate('test-template')).to.be.rejectedWith(
        'Failed to execute template test-template: Athena query failed',
      );
      expect(context.log.error).to.have.been.calledWith('CDN Template execution error: Athena query failed');
    });

    it('enhances where clause with parameters', async () => {
      serviceMocks.mockAthenaClient.query.resolves([]);
      const result = await service.executeTemplate('test-template', { agentFilter: 'chatgpt' });
      expect(result.parameters.whereClause).to.include('ChatGPT');
    });

    it('handles null CDN logs config', async () => {
      const siteWithNullConfig = createMockSite('https://example.com', null);
      const serviceWithNullConfig = new CdnAnalyticsService(context, siteWithNullConfig);

      serviceMocks.mockAthenaClient.query.resolves([]);
      const result = await serviceWithNullConfig.executeTemplate('test-template');

      expect(result.parameters.whereClause).to.be.a('string');
      expect(serviceMocks.mockLoadSql).to.have.been.called;
    });
  });

  describe('generatePeriods', () => {
    it('generates periods using week-based parameters', () => {
      const periods = CdnAnalyticsService.generatePeriods({ numberOfWeeks: 2 });
      expect(periods.weeks).to.have.length(2);
      expect(periods.weeks[0]).to.have.property('weekLabel');
      expect(periods.weeks[0]).to.have.property('startDate');
      expect(periods.weeks[0]).to.have.property('endDate');
    });

    it('generates correct week labels when counting backwards', () => {
      const periods = CdnAnalyticsService.generatePeriods({ numberOfWeeks: 3 });
      expect(periods.weeks).to.have.length(3);
      expect(periods.weeks[0].weekLabel).to.equal('week_1');
      expect(periods.weeks[1].weekLabel).to.equal('week_2');
      expect(periods.weeks[2].weekLabel).to.equal('week_3');
    });
  });

  describe('buildConditions', () => {
    const testCases = [
      {
        name: 'handles empty periods',
        periods: { weeks: [] },
        params: {},
        expected: { length: 0 },
      },
      {
        name: 'handles single date range correctly',
        periods: {
          weeks: [{
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-01-07'),
            weekLabel: 'week_1',
          }],
        },
        params: {},
        expected: { length: 1, includes: ['year = \'2025\'', 'month = \'01\''], excludes: [' OR '] },
      },
      {
        name: 'handles multiple weeks with OR grouping',
        periods: {
          weeks: [
            { startDate: new Date('2025-01-01'), endDate: new Date('2025-01-07'), weekLabel: 'week_1' },
            { startDate: new Date('2025-01-08'), endDate: new Date('2025-01-14'), weekLabel: 'week_2' },
          ],
        },
        params: {},
        expected: { length: 1, includes: ['(', ' OR '] },
      },
      {
        name: 'adds status filter condition',
        periods: { weeks: [] },
        params: { statusFilter: '404' },
        expected: { includes: ['status = 404'] },
      },
    ];

    testCases.forEach(({
      name, periods, params, expected,
    }) => {
      it(name, () => {
        const conditions = CdnAnalyticsService.buildConditions(periods, params);
        expect(conditions).to.be.an('array');

        if (expected.length !== undefined) {
          expect(conditions).to.have.length(expected.length);
        }

        if (expected.includes) {
          expected.includes.forEach((include) => {
            expect(conditions.join(' ')).to.include(include);
          });
        }

        if (expected.excludes) {
          expected.excludes.forEach((exclude) => {
            expect(conditions.join(' ')).to.not.include(exclude);
          });
        }
      });
    });
  });

  describe('getAvailableTemplates', () => {
    it('returns list of available templates', () => {
      const templates = CdnAnalyticsService.getAvailableTemplates();
      expect(templates).to.be.an('array');
      expect(templates).to.include.members([
        'user-agent-weekly-breakdown',
        'top-urls-weekly-breakdown',
        'url-analysis-weekly',
      ]);
      expect(templates).to.have.length(3);
    });
  });

  describe('executeAnalysis', () => {
    let service;

    beforeEach(() => {
      service = new CdnAnalyticsService(context, site);
      sinon.stub(service, 'executeTemplate').resolves({ mock: 'result' });
    });

    afterEach(() => {
      sinon.restore();
    });

    const typeMapping = {
      'agentic-traffic': 'user-agent-weekly-breakdown',
      'popular-content': 'top-urls-weekly-breakdown',
      'url-patterns': 'url-analysis-weekly',
      'error-analysis': 'url-analysis-weekly',
      'country-patterns': 'url-analysis-weekly',
    };

    Object.entries(typeMapping).forEach(([analysisType, templateName]) => {
      it(`maps analysisType "${analysisType}" to template "${templateName}" and calls executeTemplate`, async () => {
        const params = { foo: 'bar' };
        await service.executeAnalysis(analysisType, params);
        expect(service.executeTemplate).to.have.been.calledOnceWithExactly(templateName, params);
      });
    });

    it('throws error for unknown analysisType', async () => {
      await expect(service.executeAnalysis('unknown-type')).to.be.rejectedWith('Unknown analysis type: unknown-type');
    });
  });
});
