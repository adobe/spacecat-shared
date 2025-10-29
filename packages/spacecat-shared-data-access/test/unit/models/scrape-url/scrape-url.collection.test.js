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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub, useFakeTimers } from 'sinon';
import sinonChai from 'sinon-chai';

import ScrapeUrl from '../../../../src/models/scrape-url/scrape-url.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('ScrapeUrlCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    scrapeUrlId: 'su12345',
    scrapeJobId: 'sj12345',
    url: 'https://example.com',
    status: 'COMPLETE',
    processingType: 'DEFAULT',
    isOriginal: true,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(ScrapeUrl, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ScrapeUrlCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allRecentByUrlAndProcessingType', () => {
    let mockAllByUrlAndIsOriginalAndProcessingType;
    let clock;

    beforeEach(() => {
      mockAllByUrlAndIsOriginalAndProcessingType = stub();
      instance.allByUrlAndIsOriginalAndProcessingType = mockAllByUrlAndIsOriginalAndProcessingType;

      // Mock current time to 2024-01-15T12:00:00.000Z for consistent testing
      clock = useFakeTimers(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      clock.restore();
    });

    it('calls allByUrlAndIsOriginalAndProcessingType with correct parameters and default maxAge', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const mockResult = [{ scrapeUrlId: 'su12345' }];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      const result = await instance.allRecentByUrlAndProcessingType(url, processingType);

      expect(result).to.deep.equal(mockResult);
      expect(mockAllByUrlAndIsOriginalAndProcessingType).to.have.been.calledOnce;

      const [calledUrl,
        calledIsOriginal,
        calledProcessingType,
        calledOptions] = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args;

      expect(calledUrl).to.equal(url);
      expect(calledIsOriginal).to.be.true;
      expect(calledProcessingType).to.equal(processingType);
      expect(calledOptions).to.have.property('between');
      expect(calledOptions.between).to.have.property('attribute', 'createdAt');
      expect(calledOptions.between).to.have.property('start');
      expect(calledOptions.between).to.have.property('end', '2024-01-15T12:00:00.000Z');
    });

    it('calculates correct past date with default maxAgeInHours (168 hours)', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType);

      const calledOptions = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args[3];

      // 168 hours = 7 days before 2024-01-15T12:00:00.000Z should be 2024-01-08T12:00:00.000Z
      expect(calledOptions.between.start).to.equal('2024-01-08T12:00:00.000Z');
    });

    it('calculates correct past date with custom maxAgeInHours', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const maxAgeInHours = 24; // 1 day
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType, maxAgeInHours);

      const calledOptions = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args[3];

      // 24 hours before 2024-01-15T12:00:00.000Z should be 2024-01-14T12:00:00.000Z
      expect(calledOptions.between.start).to.equal('2024-01-14T12:00:00.000Z');
    });

    it('handles zero maxAgeInHours', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const maxAgeInHours = 0;
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType, maxAgeInHours);

      const calledOptions = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args[3];

      // 0 hours should give the same time
      expect(calledOptions.between.start).to.equal('2024-01-15T12:00:00.000Z');
      expect(calledOptions.between.end).to.equal('2024-01-15T12:00:00.000Z');
    });

    it('handles fractional maxAgeInHours', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const maxAgeInHours = 0.5; // 30 minutes
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType, maxAgeInHours);

      const calledOptions = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args[3];

      // 0.5 hours before 2024-01-15T12:00:00.000Z should be 2024-01-15T11:30:00.000Z
      expect(calledOptions.between.start).to.equal('2024-01-15T11:30:00.000Z');
    });

    it('always sets isOriginal to true', async () => {
      const url = 'https://example.com';
      const processingType = 'CUSTOM';
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType);

      const [, calledIsOriginal] = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args;
      expect(calledIsOriginal).to.be.true;
    });

    it('passes through different processing types', async () => {
      const url = 'https://example.com';
      const processingType = 'CUSTOM_TYPE';
      const mockResult = [];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(mockResult);

      await instance.allRecentByUrlAndProcessingType(url, processingType);

      const [, , calledProcessingType] = mockAllByUrlAndIsOriginalAndProcessingType.getCall(0).args;
      expect(calledProcessingType).to.equal('CUSTOM_TYPE');
    });

    it('returns the result from allByUrlAndIsOriginalAndProcessingType', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const expectedResult = [
        { scrapeUrlId: 'su1', url: 'https://example.com/1' },
        { scrapeUrlId: 'su2', url: 'https://example.com/2' },
      ];

      mockAllByUrlAndIsOriginalAndProcessingType.resolves(expectedResult);

      const result = await instance.allRecentByUrlAndProcessingType(url, processingType);

      expect(result).to.deep.equal(expectedResult);
    });

    it('propagates errors from allByUrlAndIsOriginalAndProcessingType', async () => {
      const url = 'https://example.com';
      const processingType = 'DEFAULT';
      const error = new Error('Database error');

      mockAllByUrlAndIsOriginalAndProcessingType.rejects(error);

      await expect(instance.allRecentByUrlAndProcessingType(url, processingType))
        .to.be.rejectedWith('Database error');
    });
  });
});
