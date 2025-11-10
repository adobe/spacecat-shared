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

import { use, expect, assert } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import sinon, { stub } from 'sinon';

import { ScrapeJob, ScrapeUrl } from '@adobe/spacecat-shared-data-access';
import ScrapeJobSchema from '@adobe/spacecat-shared-data-access/src/models/scrape-job/scrape-job.schema.js';
import ScrapeUrlSchema from '@adobe/spacecat-shared-data-access/src/models/scrape-url/scrape-url.schema.js';
import { ScrapeClient } from '../src/index.js';
import { ScrapeUrlDto } from '../src/clients/scrapeUrlDto.js';

use(sinonChai);
use(chaiAsPromised);

const createScrapeJob = (data) => (new ScrapeJob(
  {
    entities: {
      scrapeJob: {
        model: {
          schema: { attributes: { status: { type: 'string', get: (value) => value } } },
        },
        patch: sinon.stub().returns({ go: () => { }, set: () => { } }),
        remove: sinon.stub().returns({ go: () => { } }),
      },
    },
  },
  {
    log: console,
    getCollection: stub().returns({
      schema: ScrapeJobSchema,
      findById: stub(),
    }),
  },
  ScrapeJobSchema,
  data,
  console,
));

const createScrapeUrl = (data) => (new ScrapeUrl(
  { entities: { scrapeUrl: {} } },
  {
    log: console,
    getCollection: stub().returns({
      schema: ScrapeUrlSchema,
      findById: stub(),
    }),
  },
  ScrapeUrlSchema,
  data,
  console,
));

describe('ScrapeJobController tests', () => {
  let sandbox;
  let scrapeJobController;
  let baseContext;
  let mockSqsClient;
  let mockDataAccess;
  let scrapeJobConfiguration;
  let mockAuth;
  let mockAttributes;

  const defaultHeaders = {
    'user-agent': 'Unit test',
    'content-type': 'application/json',
  };

  const exampleCustomHeaders = {
    Authorization: 'Bearer aXsPb3183G',
  };

  const exampleJob = {
    scrapeJobId: 'f91afda0-afc8-467e-bfa3-fdbeba3037e8',
    status: 'RUNNING',
    options: {},
    baseURL: 'https://www.example.com',
    scrapeQueueId: 'spacecat-scrape-queue-1',
    processingType: 'default',
  };

  const exampleJob2 = {
    scrapeJobId: 'f91afda0-afc8-467e-bfa3-fdbeba3037e9',
    status: 'COMPLETE',
    options: {},
    baseURL: 'https://www.example.com',
    scrapeQueueId: 'spacecat-scrape-queue-2',
    processingType: 'form',
  };

  const urls = [
    'https://www.example.com/page1',
    'https://www.example.com/page2',
    'https://www.example.com/page3',
  ];

  const exampleJobStatus = {
    getId: () => exampleJob.scrapeJobId,
    getStatus: () => exampleJob.status,
    getOptions: () => exampleJob.options,
    getBaseURL: () => exampleJob.baseURL,
    getProcessingType: () => 'DEFAULT',
    getStartedAt: () => new Date(),
    getEndedAt: () => new Date(),
    getDuration: () => 1000,
    getUrlCount: () => urls.length,
    getSuccessCount: () => 0,
    getFailedCount: () => 0,
    getRedirectCount: () => 0,
    getCustomHeaders: () => ({}),
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockSqsClient = {
      sendMessage: sandbox.stub(),
      purgeQueue: sandbox.stub(),
      getQueueMessageCount: sandbox.stub(),
    };

    mockSqsClient.getQueueMessageCount.callsFake(async (queueUrl) => {
      if (queueUrl === 'spacecat-scrape-queue-1') {
        return Promise.resolve(2);
      }
      if (queueUrl === 'spacecat-scrape-queue-2') {
        return Promise.resolve(1);
      }
      if (queueUrl === 'spacecat-scrape-queue-3') {
        return Promise.resolve(4);
      }
      return Promise.resolve(0);
    });

    mockAttributes = {
      authInfo: {
        profile: {
          getName: () => 'Test User',
          getImsOrgId: () => 'TestOrgId',
          getImsUserId: () => 'TestUserId',
        },
      },
    };

    mockDataAccess = {
      ScrapeJob: {
        allByDateRange: sandbox.stub().resolves([]),
        allByStatus: sandbox.stub().resolves([]),
        create: (data) => createScrapeJob(data),
        findById: sandbox.stub(),
      },
      ScrapeUrl: {
        allByScrapeJobId: sandbox.stub().resolves([]),
        allRecentByUrlAndProcessingType: sandbox.stub().resolves([]),
        create: (data) => createScrapeUrl(data),
      },
    };

    mockDataAccess.ScrapeJob.findById.callsFake(async (jobId) => {
      if (jobId !== exampleJob.scrapeJobId) {
        throw new Error('Not found');
      }
      return createScrapeJob(exampleJob);
    });

    scrapeJobConfiguration = {
      queues: ['spacecat-scrape-queue-1', 'spacecat-scrape-queue-2', 'spacecat-scrape-queue-3'],
      scrapeWorkerQueue: 'https://sqs.us-east-1.amazonaws.com/1234567890/scrape-worker-queue',
      scrapeQueueUrlPrefix: 'https://sqs.us-east-1.amazonaws.com/1234567890/',
      s3Bucket: 'spacecat-dev-scraper',
      options: {
        enableJavascript: true,
        hideConsentBanners: false,
      },
      maxUrlsPerJob: 3,
      maxUrlsPerMessage: 2,
    };

    const { info, debug, error } = console;

    // Set up the base context
    baseContext = {
      log: {
        info,
        debug,
        error: sandbox.stub().callsFake(error),
      },
      env: {
        SCRAPE_JOB_CONFIGURATION: JSON.stringify(scrapeJobConfiguration),
      },
      sqs: mockSqsClient,
      dataAccess: mockDataAccess,
      auth: mockAuth,
      attributes: mockAttributes,
      pathInfo: {
        headers: {
          ...defaultHeaders,
        },
      },
      params: {},
      data: {
        urls,
      },
    };

    scrapeJobController = ScrapeClient.createFrom(baseContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should fail for a bad SCRAPE_JOB_CONFIGURATION', () => {
    baseContext.env.SCRAPE_JOB_CONFIGURATION = 'not a JSON string';
    try {
      ScrapeClient.createFrom(baseContext);
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(baseContext.log.error.getCall(0).args[0]).to.equal('Failed to parse or validate scrape job configuration: Unexpected token \'o\', "not a JSON string" is not valid JSON');
    }
  });

  it('should fail if a service is missing', () => {
    baseContext.sqs = undefined;
    expect(() => ScrapeClient.createFrom(baseContext)).to.throw('Invalid services: sqs is required');
  });

  describe('validateScrapeConfiguration', () => {
    it('should throw error when configuration is not an object', () => {
      expect(() => ScrapeClient.validateScrapeConfiguration(null)).to.throw('Invalid scrape configuration: configuration must be an object');
      expect(() => ScrapeClient.validateScrapeConfiguration('string')).to.throw('Invalid scrape configuration: configuration must be an object');
      expect(() => ScrapeClient.validateScrapeConfiguration(123)).to.throw('Invalid scrape configuration: configuration must be an object');
    });

    it('should throw error when scrapeWorkerQueue is missing or invalid', () => {
      const baseConfig = {};

      expect(() => ScrapeClient.validateScrapeConfiguration(baseConfig)).to.throw('Invalid scrape configuration: scrapeWorkerQueue must be a non-empty string');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        scrapeWorkerQueue: '',
      })).to.throw('Invalid scrape configuration: scrapeWorkerQueue must be a non-empty string');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        scrapeWorkerQueue: 'not-a-valid-url',
      })).to.throw('Invalid scrape configuration: scrapeWorkerQueue must be a valid URL');
    });

    it('should throw error when s3Bucket is missing or empty', () => {
      const baseConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration(baseConfig)).to.throw('Invalid scrape configuration: s3Bucket must be a non-empty string');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        s3Bucket: '',
      })).to.throw('Invalid scrape configuration: s3Bucket must be a non-empty string');
    });

    it('should throw error when options is not an object', () => {
      const baseConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        options: 'not-an-object',
      })).to.throw('Invalid scrape configuration: options must be an object');
    });

    it('should throw error when options properties have wrong types', () => {
      const baseConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        options: { enableJavascript: 'true' },
      })).to.throw('Invalid scrape configuration: options.enableJavascript must be a boolean');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        options: { hideConsentBanners: 1 },
      })).to.throw('Invalid scrape configuration: options.hideConsentBanners must be a boolean');
    });

    it('should throw error when maxUrlsPerJob is not a positive integer', () => {
      const baseConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerJob: 0,
      })).to.throw('Invalid scrape configuration: maxUrlsPerJob must be a positive integer');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerJob: -1,
      })).to.throw('Invalid scrape configuration: maxUrlsPerJob must be a positive integer');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerJob: 1.5,
      })).to.throw('Invalid scrape configuration: maxUrlsPerJob must be a positive integer');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerJob: 'not-a-number',
      })).to.throw('Invalid scrape configuration: maxUrlsPerJob must be a positive integer');
    });

    it('should throw error when maxUrlsPerMessage is not a positive integer', () => {
      const baseConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerMessage: 0,
      })).to.throw('Invalid scrape configuration: maxUrlsPerMessage must be a positive integer');

      expect(() => ScrapeClient.validateScrapeConfiguration({
        ...baseConfig,
        maxUrlsPerMessage: -5,
      })).to.throw('Invalid scrape configuration: maxUrlsPerMessage must be a positive integer');
    });

    it('should pass validation with valid configuration', () => {
      const validConfig = {
        scrapeWorkerQueue: 'https://sqs.us-east-1.amazonaws.com/682033462621/spacecat-scrape-job-manager-queue-jhoffmann.fifo',
        s3Bucket: 'spacecat-dev-scraper',
        options: {
          enableJavascript: true,
          hideConsentBanners: false,
        },
        maxUrlsPerJob: 5000,
        maxUrlsPerMessage: 1000,
      };

      expect(() => ScrapeClient.validateScrapeConfiguration(validConfig)).to.not.throw();
    });

    it('should pass validation with minimal valid configuration', () => {
      const minimalConfig = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
      };

      expect(() => ScrapeClient.validateScrapeConfiguration(minimalConfig)).to.not.throw();
    });

    it('should pass validation when optional fields are undefined', () => {
      const configWithUndefined = {
        scrapeWorkerQueue: 'https://example.com/queue',
        s3Bucket: 'my-bucket',
        options: undefined,
        maxUrlsPerJob: undefined,
        maxUrlsPerMessage: undefined,
      };

      expect(() => ScrapeClient.validateScrapeConfiguration(configWithUndefined)).to.not.throw();
    });

    it('should fail validation during construction with invalid configuration', () => {
      const invalidConfig = {
        scrapeWorkerQueue: 'invalid-url',
        s3Bucket: '',
      };

      baseContext.env.SCRAPE_JOB_CONFIGURATION = JSON.stringify(invalidConfig);
      try {
        ScrapeClient.createFrom(baseContext);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(baseContext.log.error.getCall(0).args[0]).to.include('Failed to parse or validate scrape job configuration');
      }
    });
  });

  describe('createScrapeJob', () => {
    beforeEach(() => {
      scrapeJobController = ScrapeClient.createFrom(baseContext);
    });

    it('should fail for a non-multipart/form-data request', async () => {
      delete baseContext.data;
      try {
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: missing application/json request data');
      }
    });

    it('should throw error when the urls format is incorrect', async () => {
      try {
        baseContext.data.urls = 'https://example.com/must/be/an/array';
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: urls must be provided as a non-empty array');
      }
    });

    it('should throw error when custom header is not an object', async () => {
      try {
        baseContext.data.customHeaders = JSON.stringify([42]);
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: customHeaders must be an object');
      }
    });

    it('should reject when invalid URLs are passed in', async () => {
      try {
        baseContext.data.urls = ['https://example.com/page1', 'not-a-valid-url'];
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: not-a-valid-url is not a valid URL');
      }
    });

    it('should reject when an invalid options object is provided', async () => {
      try {
        baseContext.data.options = 'options object should be an object, not a string';
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: options must be an object');
      }
    });

    it('should throw error when an non-object options param is provided', async () => {
      try {
        baseContext.data.urls = urls;
        baseContext.data.options = [12345, 42];
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: options must be an object');
      }
    });

    it('should fail if sqs fails to send a message', async () => {
      try {
        baseContext.sqs.sendMessage = sandbox.stub().throws(new Error('Queue error'));
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Queue error');
      }
    });

    it('should start a new scrape job', async () => {
      try {
        baseContext.data.customHeaders = {
          ...exampleCustomHeaders,
        };
        const job = await scrapeJobController.createScrapeJob(baseContext.data);
        expect(job).to.be.an.instanceOf(Object);

        // Verify how many messages were sent to SQS
        // we send 2 messages because we have 3 URLs and the maxUrlsPerMessage is set to 2
        expect(mockSqsClient.sendMessage).to.have.been.calledTwice;
        const firstCall = mockSqsClient.sendMessage.getCall(0);
        expect(firstCall.args[1].customHeaders).to.deep.equal({ Authorization: 'Bearer aXsPb3183G' });
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should pick another scrape queue when the first one is in use', async () => {
      baseContext.dataAccess.getScrapeJobsByStatus = sandbox.stub().resolves([
        createScrapeJob({
          ...exampleJob,
        }),
      ]);
      const job = await scrapeJobController.createScrapeJob(baseContext.data);
      expect(job).to.be.an.instanceOf(Object);

      // Verify how many messages were sent to SQS
      // we send 2 messages because we have 3 URLs and the maxUrlsPerMessage is set to 2
      expect(mockSqsClient.sendMessage).to.have.been.calledTwice;

      // Check the resulting message to the scrape-worker-queue
      const firstCall = mockSqsClient.sendMessage.getCall(0);
      const secondCall = mockSqsClient.sendMessage.getCall(1);
      expect(firstCall.args[1].batch.length).to.equal(2);
      expect(firstCall.args[0]).to.equal('https://sqs.us-east-1.amazonaws.com/1234567890/scrape-worker-queue');
      expect(secondCall.args[1].batch.length).to.equal(1);
    });

    it('should send only one message when URLs are less than maxUrlsPerMessage', async () => {
      baseContext.data.urls = ['https://example.com/page1'];
      baseContext.data.customHeaders = exampleCustomHeaders;
      const job = await scrapeJobController.createScrapeJob(baseContext.data);

      expect(job).to.be.an.instanceOf(Object);
      expect(mockSqsClient.sendMessage).to.have.been.calledOnce;

      // Check the resulting message to the scrape-worker-queue
      const firstCall = mockSqsClient.sendMessage.getCall(0);
      expect(firstCall.args[1].batch.length).to.equal(1);
      expect(firstCall.args[0]).to.equal('https://sqs.us-east-1.amazonaws.com/1234567890/scrape-worker-queue');
    });

    it('should pick up the default options when none are provided', async () => {
      baseContext.env.SCRAPE_JOB_CONFIGURATION = JSON.stringify(scrapeJobConfiguration);
      baseContext.data.customHeaders = exampleCustomHeaders;
      const job = await scrapeJobController.createScrapeJob(baseContext.data);

      expect(job).to.be.an.instanceOf(Object);
      expect(job.options).to.deep.equal({
        enableJavascript: true,
        hideConsentBanners: false,
      });
    });

    it('should fail when the number of URLs exceeds the maximum allowed', async () => {
      try {
        baseContext.data.urls = [
          'https://example.com/page1',
          'https://example.com/page2',
          'https://example.com/page3',
          'https://example.com/page4',
        ];
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: number of URLs provided (4) exceeds the maximum allowed (3)');
      }
    });

    it('should fail when the number of URLs exceeds the (default) maximum allowed', async () => {
      try {
        delete scrapeJobConfiguration.maxUrlsPerJob; // Should fall back to 1
        baseContext.env.SCRAPE_JOB_CONFIGURATION = JSON.stringify(scrapeJobConfiguration);
        baseContext.data.urls = [
          'https://example.com/page1',
          'https://example.com/page2',
        ];
        scrapeJobController = ScrapeClient.createFrom(baseContext);
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: number of URLs provided (2) exceeds the maximum allowed (1)');
      }
    });

    it('should fail when URLs are empty', async () => {
      try {
        baseContext.data.urls = [];
        await scrapeJobController.createScrapeJob(baseContext.data);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to create a new scrape job: Invalid request: urls must be provided as a non-empty array');
      }
    });
  });

  describe('getScrapeJobUrlResults', () => {
    it('should respond with an expected progress response', async () => {
      try {
        baseContext.dataAccess.getScrapeJobUrlResults = sandbox.stub().resolves([
          createScrapeJob({
            ...exampleJob,
          }),
        ]);

        // only need to provide enough scrape url data to satisfy the scrape-supervisor, no need
        // for all the other properties of a ImportUrl object.
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().resolves([
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.COMPLETE,
            getPath: () => 'path/to/result1',
            getUrl: () => 'https://example.com/page1',
            getReason: () => null,
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.COMPLETE,
            getPath: () => 'path/to/result2',
            getUrl: () => 'https://example.com/page2',
            getReason: () => null,
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.RUNNING,
            getPath: () => 'path/to/result3',
            getUrl: () => 'https://example.com/page3',
            getReason: () => null,
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.PENDING,
            getPath: () => 'path/to/result5',
            getUrl: () => 'https://example.com/page5',
            getReason: () => null,
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.REDIRECT,
            getPath: () => 'path/to/result6',
            getUrl: () => 'https://example.com/page6',
            getReason: () => null,
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.FAILED,
            getPath: () => 'path/to/result7',
            getUrl: () => 'https://example.com/page7',
            getReason: () => 'An error occurred',
          },
        ]);

        const jobs = await scrapeJobController.getScrapeJobUrlResults(exampleJob.scrapeJobId);
        expect(jobs).to.be.an.instanceOf(Array);
        expect(jobs.length).to.equal(6);

        expect(jobs).to.deep.equal([
          {
            url: 'https://example.com/page1',
            status: 'COMPLETE',
            reason: null,
            path: 'path/to/result1',
          },
          {
            url: 'https://example.com/page2',
            status: 'COMPLETE',
            reason: null,
            path: 'path/to/result2',
          },
          {
            url: 'https://example.com/page3',
            status: 'RUNNING',
            reason: null,
            path: 'path/to/result3',
          },
          {
            url: 'https://example.com/page5',
            status: 'PENDING',
            reason: null,
            path: 'path/to/result5',
          },
          {
            url: 'https://example.com/page6',
            status: 'REDIRECT',
            reason: null,
            path: 'path/to/result6',
          },
          {
            url: 'https://example.com/page7',
            status: 'FAILED',
            reason: 'An error occurred',
            path: 'path/to/result7',
          },
        ]);
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should respond a job not found for non existent jobs', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(null);
        scrapeJobController = ScrapeClient.createFrom(baseContext);
        const results = await scrapeJobController.getScrapeJobUrlResults('3ec88567-c9f8-4fb1-8361-b53985a2898b');

        expect(results).to.be.null;
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should return empty array when no scraped urls are available', async () => {
      try {
        baseContext.dataAccess.getScrapeJobProgress = sandbox.stub().resolves([
          createScrapeJob({ ...exampleJob }),
        ]);

        scrapeJobController = ScrapeClient.createFrom(baseContext);

        const results = await scrapeJobController.getScrapeJobUrlResults(exampleJob.scrapeJobId);
        expect(results).to.be.an.instanceOf(Array);
        expect(results.length).to.equal(0);
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should handle errors while trying to fetch scrape job url results gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().rejects(new Error('Failed to fetch scrape job url results'));
        await scrapeJobController.getScrapeJobUrlResults(exampleJob.scrapeJobId);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch the scrape job result: Failed to fetch scrape job url results');
      }
    });
  });

  describe('getScrapeJobStatus', () => {
    it('should fail when jobId is not provided', async () => {
      try {
        await scrapeJobController.getScrapeJobStatus();
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Job ID is required');
      }
    });

    it('should fail when jobId is not a valid UUID', async () => {
      try {
        await scrapeJobController.getScrapeJobUrlResults('not-a-valid-uuid');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch the scrape job result: jobId must be a valid UUID');
      }
    });

    it('should return null when the jobID cannot be found', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().throws(new Error('Not found'));
        scrapeJobController = ScrapeClient.createFrom(baseContext);
        const response = await scrapeJobController.getScrapeJobStatus('3ec88567-c9f8-4fb1-8361-b53985a2898b');

        expect(response).to.be.null;
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should handle errors while trying to fetch scrape job status gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().throws(new Error('Some weird error'));
        await scrapeJobController.getScrapeJobStatus(exampleJob.scrapeJobId);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape job status for jobId: f91afda0-afc8-467e-bfa3-fdbeba3037e8, message: Some weird error');
      }
    });

    it('should return job details for a valid jobId', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(exampleJobStatus);
        scrapeJobController = ScrapeClient.createFrom(baseContext);
        const jobStatus = await scrapeJobController.getScrapeJobStatus(exampleJob.scrapeJobId);
        expect(jobStatus.id).to.equal('f91afda0-afc8-467e-bfa3-fdbeba3037e8');
        expect(jobStatus.baseURL).to.equal('https://www.example.com');
        expect(jobStatus.status).to.equal('RUNNING');
        expect(jobStatus.options).to.deep.equal({});
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should handle errors while trying to fetch scrape job status gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().rejects(new Error('Failed to fetch scrape job status'));
        await scrapeJobController.getScrapeJobStatus(exampleJob.scrapeJobId);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape job status for jobId: f91afda0-afc8-467e-bfa3-fdbeba3037e8, message: Failed to fetch scrape job status');
      }
    });
  });

  describe('getScrapeJobsByDateRange', () => {
    it('should throw an error when startDate is not present', async () => {
      try {
        await scrapeJobController.getScrapeJobsByDateRange(undefined, '2024-05-29T14:26:00.000Z');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Invalid request: startDate and endDate must be in ISO 8601 format');
      }
    });

    it('should throw an error when endDate is not present', async () => {
      try {
        await scrapeJobController.getScrapeJobsByDateRange('2024-05-29T14:26:00.000Z', undefined);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Invalid request: startDate and endDate must be in ISO 8601 format');
      }
    });

    it('should return an array of scrape jobs', async () => {
      const job = createScrapeJob(exampleJob);
      baseContext.dataAccess.ScrapeJob.allByDateRange = sandbox.stub().resolves([job]);

      const jobs = await scrapeJobController.getScrapeJobsByDateRange('2022-10-05T14:48:00.000Z', '2022-10-07T14:48:00.000Z');
      expect(jobs).to.be.an.instanceOf(Array);
      expect(jobs.length).to.equal(1);
      expect(jobs[0].baseURL).to.equal('https://www.example.com');
    });

    it('should handle errors while trying to fetch scrape jobs by date range gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.allByDateRange = sandbox.stub().rejects(new Error('Failed to fetch scrape jobs by date range'));
        await scrapeJobController.getScrapeJobsByDateRange('2022-10-05T14:48:00.000Z', '2022-10-07T14:48:00.000Z');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape jobs between startDate: 2022-10-05T14:48:00.000Z and endDate: 2022-10-07T14:48:00.000Z, Failed to fetch scrape jobs by date range');
      }
    });
  });

  describe('ScrapeJobSupervisor', () => {
    it('should fail to validate the required services, if one is missing', async () => {
      const context = {
        ...baseContext,
        dataAccess: undefined,
      };
      expect(() => ScrapeClient.createFrom(context)).to.throw('Invalid services: dataAccess is required');
    });

    describe('getScrapeUrlsByProcessingType', () => {
      let testScrapeJobController;

      beforeEach(() => {
        // Create a fresh controller for each test
        testScrapeJobController = ScrapeClient.createFrom(baseContext);
      });

      it('should throw error for invalid URL in supervisor', async () => {
        try {
          // Access the supervisor directly to test its error handling
          await testScrapeJobController.scrapeSupervisor.getScrapeUrlsByProcessingType('invalid-url', 'default', 168);
          assert.fail('Expected error to be thrown');
        } catch (err) {
          expect(err.message).to.equal('invalid-url must be a valid URL');
        }
      });

      it('should return successful result when data is found', async () => {
        const mockScrapeUrls = [{
          getId: () => 'url-id-1',
          getUrl: () => 'https://example.com/test',
          getProcessingType: () => 'default',
          getOptions: () => ({}),
          getStatus: () => 'COMPLETE',
          getPath: () => 'path/to/result',
          getScrapeJobId: () => 'job-id',
          getCreatedAt: () => new Date(),
        }];

        // Create a new context with the specific mock for this test
        const testContext = {
          ...baseContext,
          dataAccess: {
            ...mockDataAccess,
            ScrapeUrl: {
              ...mockDataAccess.ScrapeUrl,
              allRecentByUrlAndProcessingType: sandbox.stub().resolves(mockScrapeUrls),
            },
          },
        };
        testScrapeJobController = ScrapeClient.createFrom(testContext);

        const result = await testScrapeJobController.scrapeSupervisor.getScrapeUrlsByProcessingType('https://example.com/test', 'default', 168);
        expect(result).to.deep.equal(mockScrapeUrls);
      });

      it('should return null when "Not found" error occurs in supervisor', async () => {
        // Create a new context with the specific mock for this test
        const testContext = {
          ...baseContext,
          dataAccess: {
            ...mockDataAccess,
            ScrapeUrl: {
              ...mockDataAccess.ScrapeUrl,
              allRecentByUrlAndProcessingType: sandbox.stub().callsFake(() => {
                throw new Error('Item Not found in database');
              }),
            },
          },
        };
        testScrapeJobController = ScrapeClient.createFrom(testContext);

        const result = await testScrapeJobController.scrapeSupervisor.getScrapeUrlsByProcessingType('https://example.com/test', 'default', 168);
        expect(result).to.be.null;
      });

      it('should re-throw non-"Not found" errors in supervisor', async () => {
        // Create a new context with the specific mock for this test
        const testContext = {
          ...baseContext,
          dataAccess: {
            ...mockDataAccess,
            ScrapeUrl: {
              ...mockDataAccess.ScrapeUrl,
              allRecentByUrlAndProcessingType: sandbox.stub().callsFake(() => {
                throw new Error('Database connection failed');
              }),
            },
          },
        };
        testScrapeJobController = ScrapeClient.createFrom(testContext);

        try {
          await testScrapeJobController.scrapeSupervisor.getScrapeUrlsByProcessingType('https://example.com/test', 'default', 168);
          assert.fail('Expected error to be thrown');
        } catch (err) {
          expect(err.message).to.equal('Database connection failed');
        }
      });
    });
  });

  describe('getScrapeResultPaths', () => {
    it('should return a Map of URL to path for complete scrape URLs', async () => {
      try {
        const job = createScrapeJob(exampleJob);
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(job);
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().resolves([
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.COMPLETE,
            getPath: () => 'path/to/result1',
            getUrl: () => 'https://example.com/page1',
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.COMPLETE,
            getPath: () => 'path/to/result2',
            getUrl: () => 'https://example.com/page2',
          },
        ]);

        const resultPaths = await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        expect(resultPaths).to.be.an.instanceOf(Map);
        expect(resultPaths.size).to.equal(2);
        expect(resultPaths.get('https://example.com/page1')).to.equal('path/to/result1');
        expect(resultPaths.get('https://example.com/page2')).to.equal('path/to/result2');
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should return null when job is not found', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(null);
        scrapeJobController = ScrapeClient.createFrom(baseContext);

        const resultPaths = await scrapeJobController.getScrapeResultPaths('3ec88567-c9f8-4fb1-8361-b53985a2898b');
        expect(resultPaths).to.be.null;
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should only include URLs with COMPLETE status', async () => {
      try {
        const job = createScrapeJob(exampleJob);
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(job);
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().resolves([
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.COMPLETE,
            getPath: () => 'path/to/result1',
            getUrl: () => 'https://example.com/page1',
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.RUNNING,
            getPath: () => 'path/to/result2',
            getUrl: () => 'https://example.com/page2',
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.FAILED,
            getPath: () => 'path/to/result3',
            getUrl: () => 'https://example.com/page3',
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.PENDING,
            getPath: () => 'path/to/result4',
            getUrl: () => 'https://example.com/page4',
          },
        ]);

        const resultPaths = await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        expect(resultPaths).to.be.an.instanceOf(Map);
        expect(resultPaths.size).to.equal(1);
        expect(resultPaths.get('https://example.com/page1')).to.equal('path/to/result1');
        expect(resultPaths.has('https://example.com/page2')).to.be.false;
        expect(resultPaths.has('https://example.com/page3')).to.be.false;
        expect(resultPaths.has('https://example.com/page4')).to.be.false;
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should return empty Map when no URLs have COMPLETE status', async () => {
      try {
        const job = createScrapeJob(exampleJob);
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(job);
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().resolves([
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.RUNNING,
            getPath: () => 'path/to/result1',
            getUrl: () => 'https://example.com/page1',
          },
          {
            getStatus: () => ScrapeJob.ScrapeUrlStatus.FAILED,
            getPath: () => 'path/to/result2',
            getUrl: () => 'https://example.com/page2',
          },
        ]);

        const resultPaths = await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        expect(resultPaths).to.be.an.instanceOf(Map);
        expect(resultPaths.size).to.equal(0);
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should return empty Map when no scrape URLs exist for the job', async () => {
      try {
        const job = createScrapeJob(exampleJob);
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(job);
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().resolves([]);

        const resultPaths = await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        expect(resultPaths).to.be.an.instanceOf(Map);
        expect(resultPaths.size).to.equal(0);
      } catch (err) {
        assert.fail(err);
      }
    });

    it('should handle errors when fetching scrape job gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().rejects(new Error('Database connection failed'));
        await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch the scrape job result: Database connection failed');
      }
    });

    it('should handle errors when fetching scrape URLs gracefully', async () => {
      try {
        const job = createScrapeJob(exampleJob);
        baseContext.dataAccess.ScrapeJob.findById = sandbox.stub().resolves(job);
        baseContext.dataAccess.ScrapeUrl.allByScrapeJobId = sandbox.stub().rejects(new Error('Failed to fetch scrape URLs'));

        await scrapeJobController.getScrapeResultPaths(exampleJob.scrapeJobId);
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch the scrape job result: Failed to fetch scrape URLs');
      }
    });
  });

  describe('getScrapeJobsByBaseURL', () => {
    it('should return an array of scrape jobs', async () => {
      const job = createScrapeJob(exampleJob);
      baseContext.dataAccess.ScrapeJob.allByBaseURL = sandbox.stub().resolves([job]);

      const jobs = await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com');
      expect(jobs).to.be.an.instanceOf(Array);
      expect(jobs[0].baseURL).to.equal('https://www.example.com');
    });

    it('should return an empty array if no jobs are found for this baseUrl', async () => {
      baseContext.dataAccess.ScrapeJob.allByBaseURL = sandbox.stub().resolves([]);

      const jobs = await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com');
      expect(jobs).to.be.an.instanceOf(Array);
      expect(jobs).to.deep.equal([]);
    });

    it('should handle errors while trying to fetch scrape jobs by baseURL without processingType gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.allByBaseURL = sandbox.stub().rejects(new Error('Failed to fetch scrape jobs by baseURL'));

        await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape jobs by baseURL: https://www.example.com, Failed to fetch scrape jobs by baseURL');
      }
    });

    it('should handle errors while trying to fetch scrape jobs by baseURL with processingType gracefully', async () => {
      try {
        baseContext.dataAccess.ScrapeJob.allByBaseURLAndProcessingType = sandbox.stub().rejects(new Error('Failed to fetch scrape jobs by baseURL'));

        await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com', 'default');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape jobs by baseURL: https://www.example.com and processing type: default, Failed to fetch scrape jobs by baseURL');
      }
    });

    it('should handle invalid baseURL gracefully', async () => {
      try {
        await scrapeJobController.getScrapeJobsByBaseURL('invalid-baseURL');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal(
          'Failed to fetch scrape jobs by baseURL: invalid-baseURL, Invalid request: baseURL must be a valid URL',
        );
      }
    });

    it('should return an array of scrape jobs by baseURL and processing type', async () => {
      const job = createScrapeJob(exampleJob);
      const job2 = createScrapeJob(exampleJob2);
      baseContext.dataAccess.ScrapeJob.allByBaseURL = sandbox.stub().resolves([job, job2]);
      baseContext.dataAccess.ScrapeJob.allByBaseURLAndProcessingType = sandbox
        .stub()
        .resolves([job]);

      const jobs = await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com', 'default');
      expect(jobs).to.be.an.instanceOf(Array);
      expect(jobs.length).to.equal(1);
      expect(jobs[0].baseURL).to.equal('https://www.example.com');
    });

    it('should return an array of scrape jobs by baseURL without processingType', async () => {
      const job = createScrapeJob(exampleJob);
      const job2 = createScrapeJob(exampleJob2);
      baseContext.dataAccess.ScrapeJob.allByBaseURL = sandbox.stub().resolves([job, job2]);
      baseContext.dataAccess.ScrapeJob.allByBaseURLAndProcessingType = sandbox
        .stub()
        .resolves([job]);

      const jobs = await scrapeJobController.getScrapeJobsByBaseURL('https://www.example.com');
      expect(jobs).to.be.an.instanceOf(Array);
      expect(jobs.length).to.equal(2);
      expect(jobs[0].baseURL).to.equal('https://www.example.com');
      expect(jobs[1].baseURL).to.equal('https://www.example.com');
    });
  });

  describe('getScrapeUrlsByProcessingType', () => {
    it('should return scrape URLs for valid URL and processing type', async () => {
      const mockScrapeUrls = [
        {
          getId: () => 'url-id-1',
          getUrl: () => 'https://example.com/page1',
          getProcessingType: () => 'default',
          getOptions: () => ({ enableJavascript: true }),
          getStatus: () => 'COMPLETE',
          getPath: () => 'path/to/result1',
          getScrapeJobId: () => 'job-id-1',
          getCreatedAt: () => new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          getId: () => 'url-id-2',
          getUrl: () => 'https://example.com/page2',
          getProcessingType: () => 'default',
          getOptions: () => ({ enableJavascript: false }),
          getStatus: () => 'COMPLETE',
          getPath: () => 'path/to/result2',
          getScrapeJobId: () => 'job-id-2',
          getCreatedAt: () => new Date('2024-01-02T00:00:00.000Z'),
        },
      ];

      // eslint-disable-next-line max-len
      baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType = sandbox.stub().resolves(mockScrapeUrls);
      scrapeJobController = ScrapeClient.createFrom(baseContext);

      const result = await scrapeJobController.getScrapeUrlsByProcessingType('https://example.com/page1', 'default', 168);

      expect(result).to.be.an.instanceOf(Array);
      expect(result.length).to.equal(2);
      expect(result[0]).to.deep.equal({
        id: 'url-id-1',
        url: 'https://example.com/page1',
        processingType: 'default',
        options: { enableJavascript: true },
        status: 'COMPLETE',
        path: 'path/to/result1',
        scrapeJobId: 'job-id-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });
    });

    it('should return null when no scrape URLs are found', async () => {
      // eslint-disable-next-line max-len
      baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType = sandbox.stub().resolves([]);
      scrapeJobController = ScrapeClient.createFrom(baseContext);

      const result = await scrapeJobController.getScrapeUrlsByProcessingType('https://example.com/nonexistent', 'default');

      expect(result).to.be.null;
    });

    it('should handle URL decoding correctly', async () => {
      const encodedUrl = encodeURIComponent('https://example.com/page with spaces');
      const mockScrapeUrls = [{
        getId: () => 'url-id-1',
        getUrl: () => 'https://example.com/page with spaces',
        getProcessingType: () => 'default',
        getOptions: () => ({}),
        getStatus: () => 'COMPLETE',
        getPath: () => 'path/to/result',
        getScrapeJobId: () => 'job-id',
        getCreatedAt: () => new Date(),
      }];

      // eslint-disable-next-line max-len
      baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType = sandbox.stub().resolves(mockScrapeUrls);
      scrapeJobController = ScrapeClient.createFrom(baseContext);

      const result = await scrapeJobController.getScrapeUrlsByProcessingType(encodedUrl, 'default');

      expect(result).to.be.an.instanceOf(Array);
      expect(result.length).to.equal(1);
    });

    it('should throw error for invalid URL', async () => {
      try {
        await scrapeJobController.getScrapeUrlsByProcessingType('invalid-url', 'default');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.include('Failed to fetch scrape URL by URL: invalid-url and processing type: default');
        expect(err.message).to.include('must be a valid URL');
      }
    });

    it('should handle errors from data access layer gracefully', async () => {
      baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType = sandbox.stub().rejects(new Error('Database error'));
      scrapeJobController = ScrapeClient.createFrom(baseContext);

      try {
        await scrapeJobController.getScrapeUrlsByProcessingType('https://example.com/test', 'default');
        assert.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch scrape URL by URL: https://example.com/test and processing type: default, Database error');
      }
    });

    it('should use default maxScrapeAge when not provided', async () => {
      const mockScrapeUrls = [{
        getId: () => 'url-id-1',
        getUrl: () => 'https://example.com/test',
        getProcessingType: () => 'default',
        getOptions: () => ({}),
        getStatus: () => 'COMPLETE',
        getPath: () => 'path/to/result',
        getScrapeJobId: () => 'job-id',
        getCreatedAt: () => new Date(),
      }];

      // eslint-disable-next-line max-len
      baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType = sandbox.stub().resolves(mockScrapeUrls);
      scrapeJobController = ScrapeClient.createFrom(baseContext);

      await scrapeJobController.getScrapeUrlsByProcessingType('https://example.com/test', 'default');

      // eslint-disable-next-line max-len
      expect(baseContext.dataAccess.ScrapeUrl.allRecentByUrlAndProcessingType).to.have.been.calledWith(
        'https://example.com/test',
        'default',
        168,
      );
    });
  });

  describe('ScrapeUrlDto', () => {
    it('should convert a scrape URL object to JSON format', () => {
      const mockScrapeUrl = {
        getId: () => 'test-id-123',
        getUrl: () => 'https://example.com/test-page',
        getProcessingType: () => 'default',
        getOptions: () => ({ enableJavascript: true }),
        getStatus: () => 'COMPLETE',
        getPath: () => 'path/to/scraped/content',
        getScrapeJobId: () => 'job-id-456',
        getCreatedAt: () => new Date('2024-01-01T00:00:00.000Z'),
      };

      const result = ScrapeUrlDto.toJSON(mockScrapeUrl);

      expect(result).to.deep.equal({
        id: 'test-id-123',
        url: 'https://example.com/test-page',
        processingType: 'default',
        options: { enableJavascript: true },
        status: 'COMPLETE',
        path: 'path/to/scraped/content',
        scrapeJobId: 'job-id-456',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });
    });

    it('should handle null/undefined values in scrape URL object', () => {
      const mockScrapeUrl = {
        getId: () => null,
        getUrl: () => 'https://example.com/test',
        getProcessingType: () => undefined,
        getOptions: () => null,
        getStatus: () => 'PENDING',
        getPath: () => undefined,
        getScrapeJobId: () => 'job-id',
        getCreatedAt: () => null,
      };

      const result = ScrapeUrlDto.toJSON(mockScrapeUrl);

      expect(result).to.deep.equal({
        id: null,
        url: 'https://example.com/test',
        processingType: undefined,
        options: null,
        status: 'PENDING',
        path: undefined,
        scrapeJobId: 'job-id',
        createdAt: null,
      });
    });
  });
});
