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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import ScrapeJob from '../../../../src/models/scrape-job/scrape-job.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('ScrapeJobCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    scrapeJobId: 's12345',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(ScrapeJob, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ScrapeJobCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allByDateRange', () => {
    it('throws an error if the startDate is not a valid iso date', async () => {
      await expect(instance.allByDateRange()).to.be.rejectedWith('Invalid start date: undefined');
    });

    it('throws an error if the endDate is not a valid iso date', async () => {
      const startIsoDate = '2024-12-06T08:35:24.125Z';
      await expect(instance.allByDateRange(startIsoDate)).to.be.rejectedWith('Invalid end date: undefined');
    });

    it('returns all scrape jobs by date range', async () => {
      const startIsoDate = '2024-12-06T08:35:24.125Z';
      const endIsoDate = '2024-12-07T08:35:24.125Z';

      const mockResult = [{ scrapeJobId: 's12345' }];

      instance.all = stub().resolves(mockResult);

      const result = await instance.allByDateRange(startIsoDate, endIsoDate);

      expect(result).to.deep.equal(mockResult);
      expect(instance.all).to.have.been.calledWithExactly({}, {
        between:
          {
            attribute: 'startedAt',
            start: '2024-12-06T08:35:24.125Z',
            end: '2024-12-07T08:35:24.125Z',
          },
      });
    });
  });

  describe('opt flag accessor parity', () => {
    beforeEach(() => {
      instance.entity = undefined;
    });

    it('uses indexed query path when opt flag columns exist', async () => {
      const expected = [{ getId: () => 'job-1' }];
      instance.allByIndexKeys = stub().resolves(expected);

      const result = await instance
        .allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
          'https://example.com',
          ScrapeJob.ScrapeProcessingType.DEFAULT,
          'T',
          'F',
        );

      expect(result).to.equal(expected);
      expect(instance.allByIndexKeys).to.have.been.calledOnceWithExactly({
        baseURL: 'https://example.com',
        processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
        optEnableJavascript: 'T',
        optHideConsentBanner: 'F',
      }, {});
    });

    it('rethrows errors from indexed query path', async () => {
      instance.allByIndexKeys = stub().rejects(new Error('db unavailable'));

      await expect(instance
        .allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
          'https://example.com',
          ScrapeJob.ScrapeProcessingType.DEFAULT,
          'T',
          'F',
        )).to.be.rejectedWith('db unavailable');
    });

    it('finds first matching scrape job by option flags', async () => {
      instance.allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner = stub()
        .resolves([{ getId: () => 'job-1' }, { getId: () => 'job-2' }]);

      const result = await instance
        .findByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
          'https://example.com',
          ScrapeJob.ScrapeProcessingType.DEFAULT,
          'T',
          'F',
        );

      expect(result.getId()).to.equal('job-1');
    });

    it('returns model when query result is a single item', async () => {
      instance.allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner = stub()
        .resolves({ getId: () => 'job-1' });

      const result = await instance
        .findByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
          'https://example.com',
          ScrapeJob.ScrapeProcessingType.DEFAULT,
          'T',
          'F',
        );

      expect(result.getId()).to.equal('job-1');
    });
  });

  describe('postgrest accessor parity', () => {
    it('maps opt flag accessor keys to expected snake_case fields', async () => {
      const query = {
        select: stub().returnsThis(),
        order: stub().returnsThis(),
        eq: stub().returnsThis(),
        range: stub().returnsThis(),
        then: (onFulfilled, onRejected) => Promise.resolve({
          data: [{
            id: '5f1c80df-e39f-4ea8-8a71-c9b36bcce640',
            base_url: 'https://example.com',
            processing_type: 'default',
            status: 'RUNNING',
            started_at: '2024-12-06T08:35:24.125Z',
          }],
          error: null,
        }).then(onFulfilled, onRejected),
      };
      const from = stub().returns({
        select: stub().returns(query),
      });

      instance.entity = undefined;
      instance.postgrestService = { from };

      await instance.allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
        'https://example.com',
        'default',
        'T',
        'F',
      );

      expect(query.eq).to.have.been.calledWith('base_url', 'https://example.com');
      expect(query.eq).to.have.been.calledWith('processing_type', 'default');
      expect(query.eq).to.have.been.calledWith('opt_enable_javascript', 'T');
      expect(query.eq).to.have.been.calledWith('opt_hide_consent_banner', 'F');
    });
  });
});
