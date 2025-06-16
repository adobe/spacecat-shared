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

describe('ScrapeJobModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      scrapeJobId: 'sug12345',
      baseURL: 'https://example.com',
      duration: 0,
      endedAt: '2022-01-01T00:00:00.000Z',
      failedCount: 0,
      customHeaders: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      hashedApiKey: 'someHashedApiKey',
      scrapeQueueId: 'iq12345',
      initiatedBy: {
        apiKeyName: 'someApiKeyName',
        imsOrgId: 'someImsOrgId',
        imsUserId: 'someImsUserId',
        userAgent: 'someUserAgent',
      },
      processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
      options: {
        enableJavascript: true,
        pageLoadTimeout: 10000,
        hideConsentBanners: true,
        waitForSelector: 'body',
        screenshotTypes: [
          ScrapeJob.ScrapeScreenshotType.SCROLL,
          ScrapeJob.ScrapeScreenshotType.BLOCK],
      },
      redirectCount: 0,
      status: 'RUNNING',
      startedAt: '2022-01-01T00:00:00.000Z',
      successCount: 0,
      urlCount: 0,
    };

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(ScrapeJob, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the ScrapeJob instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('scrapeJobId', () => {
    it('gets scrapeJobId', () => {
      expect(instance.getId()).to.equal('sug12345');
    });
  });

  describe('baseURL', () => {
    it('gets baseURL', () => {
      expect(instance.getBaseURL()).to.equal('https://example.com');
    });

    it('sets baseURL', () => {
      const newBaseURL = 'https://newexample.com';
      instance.setBaseURL(newBaseURL);
      expect(instance.getBaseURL()).to.equal(newBaseURL);
    });
  });

  describe('duration', () => {
    it('gets duration', () => {
      expect(instance.getDuration()).to.equal(0);
    });

    it('sets duration', () => {
      const newDuration = 100;
      instance.setDuration(newDuration);
      expect(instance.getDuration()).to.equal(newDuration);
    });
  });

  describe('endedAt', () => {
    it('gets endedAt', () => {
      expect(instance.getEndedAt()).to.equal('2022-01-01T00:00:00.000Z');
    });

    it('sets endedAt', () => {
      const newEndedAt = '2023-01-01T00:00:00.000Z';
      instance.setEndedAt(newEndedAt);
      expect(instance.getEndedAt()).to.equal(newEndedAt);
    });
  });

  describe('failedCount', () => {
    it('gets failedCount', () => {
      expect(instance.getFailedCount()).to.equal(0);
    });

    it('sets failedCount', () => {
      const newFailedCount = 1;
      instance.setFailedCount(newFailedCount);
      expect(instance.getFailedCount()).to.equal(newFailedCount);
    });
  });

  describe('processingType', () => {
    it('gets processingType', () => {
      expect(instance.getProcessingType()).to.equal(ScrapeJob.ScrapeProcessingType.DEFAULT);
    });

    it('sets processingType', () => {
      const newProcessingType = ScrapeJob.ScrapeProcessingType.ACCESSIBILITY;
      instance.setProcessingType(newProcessingType);
      expect(instance.getProcessingType()).to.equal(newProcessingType);
    });
  });

  describe('customHeaders', () => {
    it('gets customHeaders', () => {
      expect(instance.getCustomHeaders()).to.equal(mockRecord.customHeaders);
    });

    it('sets customHeaders', () => {
      instance.setCustomHeaders({
        'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      expect(instance.getCustomHeaders()).to.eql({
        'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    });
  });

  describe('scrapeQueueId', () => {
    it('gets scrapeQueueId', () => {
      expect(instance.getScrapeQueueId()).to.equal('iq12345');
    });

    it('sets scrapeQueueId', () => {
      const newScrapeQueueId = 'iq67890';
      instance.setScrapeQueueId(newScrapeQueueId);
      expect(instance.getScrapeQueueId()).to.equal(newScrapeQueueId);
    });
  });

  describe('options', () => {
    it('no options', () => {
      instance.setOptions(undefined);
      expect(instance.getOptions()).to.be.undefined;
    });

    it('gets options', () => {
      expect(instance.getOptions()).to.deep.equal({
        enableJavascript: true,
        pageLoadTimeout: 10000,
        hideConsentBanners: true,
        waitForSelector: 'body',
        screenshotTypes: [
          ScrapeJob.ScrapeScreenshotType.SCROLL,
          ScrapeJob.ScrapeScreenshotType.BLOCK,
        ],
      });
    });

    it('sets options', () => {
      const newOptions = { newOption: 'newValue' };
      instance.setOptions(newOptions);
      expect(instance.getOptions()).to.deep.equal(newOptions);
    });
  });

  describe('redirectCount', () => {
    it('gets redirectCount', () => {
      expect(instance.getRedirectCount()).to.equal(0);
    });

    it('sets redirectCount', () => {
      const newRedirectCount = 1;
      instance.setRedirectCount(newRedirectCount);
      expect(instance.getRedirectCount()).to.equal(newRedirectCount);
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal('RUNNING');
    });

    it('sets status', () => {
      const newStatus = 'COMPLETE';
      instance.setStatus(newStatus);
      expect(instance.getStatus()).to.equal(newStatus);
    });
  });

  describe('startedAt', () => {
    it('gets startedAt', () => {
      expect(instance.getStartedAt()).to.equal('2022-01-01T00:00:00.000Z');
    });
  });

  describe('successCount', () => {
    it('gets successCount', () => {
      expect(instance.getSuccessCount()).to.equal(0);
    });

    it('sets successCount', () => {
      const newSuccessCount = 1;
      instance.setSuccessCount(newSuccessCount);
      expect(instance.getSuccessCount()).to.equal(newSuccessCount);
    });
  });

  describe('urlCount', () => {
    it('gets urlCount', () => {
      expect(instance.getUrlCount()).to.equal(0);
    });

    it('sets urlCount', () => {
      const newUrlCount = 1;
      instance.setUrlCount(newUrlCount);
      expect(instance.getUrlCount()).to.equal(newUrlCount);
    });
  });
});
