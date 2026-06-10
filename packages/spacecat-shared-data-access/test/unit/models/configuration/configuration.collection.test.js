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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import ConfigurationCollection from '../../../../src/models/configuration/configuration.collection.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

/**
 * Creates a mock S3 response body without using sdkStreamMixin.
 * @param {object} data - The data to return as JSON.
 * @returns {object} Mock body with transformToString method.
 */
const createMockS3Body = (data) => ({
  transformToString: async () => JSON.stringify(data),
});

describe('ConfigurationCollection', () => {
  let instance;
  let mockS3Client;
  let mockLogger;

  const mockRecord = {
    queues: {
      someQueue: {},
    },
    jobs: [],
  };

  beforeEach(() => {
    mockS3Client = {
      send: stub(),
    };

    mockLogger = {
      info: stub(),
      warn: stub(),
      error: stub(),
      debug: stub(),
    };

    const s3Config = { s3Client: mockS3Client, s3Bucket: 'test-bucket' };
    instance = new ConfigurationCollection(s3Config, mockLogger);
  });

  describe('constructor', () => {
    it('initializes the ConfigurationCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.log).to.equal(mockLogger);
      expect(instance.s3Client).to.equal(mockS3Client);
      expect(instance.s3Bucket).to.equal('test-bucket');
    });

    it('initializes without S3 config when not provided', () => {
      const collectionWithoutS3 = new ConfigurationCollection(null, mockLogger);

      expect(collectionWithoutS3.s3Client).to.be.undefined;
      expect(collectionWithoutS3.s3Bucket).to.be.undefined;
    });

    it('initializes with S3 config when provided', () => {
      const s3Config = { s3Client: mockS3Client, s3Bucket: 'my-bucket' };
      const collectionWithS3 = new ConfigurationCollection(s3Config, mockLogger);

      expect(collectionWithS3.s3Client).to.equal(mockS3Client);
      expect(collectionWithS3.s3Bucket).to.equal('my-bucket');
    });
  });

  describe('create', () => {
    it('creates a new configuration in S3 and captures VersionId', async () => {
      mockS3Client.send.resolves({ VersionId: 'new-version-id-123' });

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal('new-version-id-123');
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.create(mockRecord))
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 put fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.create(mockRecord))
        .to.be.rejectedWith('Failed to create configuration in S3');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.create(mockRecord))
        .to.be.rejectedWith('Original error');
    });

    it('throws validation error when configuration schema is invalid', async () => {
      const invalidConfig = {
        // Missing required 'queues' field
        jobs: [],
      };

      await expect(instance.create(invalidConfig))
        .to.be.rejectedWith('Configuration validation error');
    });
  });

  describe('findByVersion', () => {
    it('finds configuration by S3 version ID and sets configurationId', async () => {
      const versionId = 'abc123-version-id';
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findByVersion(versionId);

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(versionId);
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('returns null when version not found', async () => {
      const noSuchVersionError = new Error('NoSuchVersion');
      noSuchVersionError.name = 'NoSuchVersion';
      mockS3Client.send.rejects(noSuchVersionError);

      const result = await instance.findByVersion('non-existent-version');

      expect(result).to.be.null;
    });

    it('throws error when S3 get fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.findByVersion('some-version'))
        .to.be.rejectedWith('Failed to retrieve configuration with version');
    });
  });

  describe('findLatest', () => {
    it('returns the latest configuration from S3 with VersionId as configurationId', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
        VersionId: 'latest-version-id',
      });

      const result = await instance.findLatest();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal('latest-version-id');
    });

    it('returns null when no configuration exists in S3', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.rejects(noSuchKeyError);

      const result = await instance.findLatest();

      expect(result).to.be.null;
    });

    it('throws error when S3 get fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.findLatest())
        .to.be.rejectedWith('Failed to retrieve configuration from S3');
    });
  });

  describe('S3 configuration requirement', () => {
    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      const expectedError = 'S3 configuration is required for Configuration storage';

      await expect(instance.create(mockRecord)).to.be.rejectedWith(expectedError);
      await expect(instance.findByVersion('v1')).to.be.rejectedWith(expectedError);
      await expect(instance.findLatest()).to.be.rejectedWith(expectedError);
    });
  });

  describe('DataAccessError handling', () => {
    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      // Test all methods that have this pattern
      await expect(instance.findByVersion('v1')).to.be.rejectedWith('Original error');
      await expect(instance.findLatest()).to.be.rejectedWith('Original error');
    });
  });

  describe('Retry logic with exponential backoff', () => {
    let randomStub;

    beforeEach(() => {
      // Stub Math.random to return 0.5, giving jitter multiplier of 1.0
      // This makes delays deterministic: 100ms, 200ms, 400ms
      randomStub = stub(Math, 'random').returns(0.5);
    });

    afterEach(() => {
      randomStub.restore();
    });

    describe('findLatest retry behavior', () => {
      it('retries on EBUSY DNS error and succeeds on second attempt', async () => {
        const ebusyError = new Error('getaddrinfo EBUSY spacecat-prod-importer.s3.us-east-1.amazonaws.com');
        ebusyError.code = 'EBUSY';

        // First call fails, second succeeds
        mockS3Client.send
          .onFirstCall().rejects(ebusyError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'retry-success-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal('retry-success-version');
        expect(mockS3Client.send).to.have.been.calledTwice;
        expect(mockLogger.warn).to.have.been.calledWith('S3 operation failed with EBUSY, retrying in 100ms (attempt 1/3)');
      });

      it('retries on ECONNRESET error and succeeds on third attempt', async () => {
        const connResetError = new Error('Connection reset');
        connResetError.code = 'ECONNRESET';

        mockS3Client.send
          .onFirstCall().rejects(connResetError)
          .onSecondCall().rejects(connResetError)
          .onThirdCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'third-try-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal('third-try-version');
        expect(mockS3Client.send).to.have.been.calledThrice;
        expect(mockLogger.warn).to.have.been.calledWith('S3 operation failed with ECONNRESET, retrying in 100ms (attempt 1/3)');
        expect(mockLogger.warn).to.have.been.calledWith('S3 operation failed with ECONNRESET, retrying in 200ms (attempt 2/3)');
      });

      it('retries on ETIMEDOUT error', async () => {
        const timeoutError = new Error('Connection timeout');
        timeoutError.code = 'ETIMEDOUT';

        mockS3Client.send
          .onFirstCall().rejects(timeoutError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'timeout-retry-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(mockS3Client.send).to.have.been.calledTwice;
      });

      it('retries on ENOTFOUND error', async () => {
        const notFoundError = new Error('DNS not found');
        notFoundError.code = 'ENOTFOUND';

        mockS3Client.send
          .onFirstCall().rejects(notFoundError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'notfound-retry-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(mockS3Client.send).to.have.been.calledTwice;
      });

      it('retries on NetworkingError', async () => {
        const networkError = new Error('Network error');
        networkError.name = 'NetworkingError';

        mockS3Client.send
          .onFirstCall().rejects(networkError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'network-retry-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(mockS3Client.send).to.have.been.calledTwice;
      });

      it('retries on error with getaddrinfo in message', async () => {
        const dnsError = new Error('Some error with getaddrinfo details');

        mockS3Client.send
          .onFirstCall().rejects(dnsError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'getaddrinfo-retry-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(mockS3Client.send).to.have.been.calledTwice;
      });

      it('throws after max retries (3 attempts) are exhausted', async () => {
        const ebusyError = new Error('getaddrinfo EBUSY spacecat-prod-importer.s3.us-east-1.amazonaws.com');
        ebusyError.code = 'EBUSY';

        mockS3Client.send.rejects(ebusyError);

        await expect(instance.findLatest())
          .to.be.rejectedWith('Failed to retrieve configuration from S3');

        // Should try: initial + 3 retries = 4 total calls
        expect(mockS3Client.send).to.have.callCount(4);
        expect(mockLogger.warn).to.have.been.calledThrice;
      });

      it('does not retry non-retryable errors', async () => {
        const randomError = new Error('Some other error');

        mockS3Client.send.rejects(randomError);

        await expect(instance.findLatest())
          .to.be.rejectedWith('Failed to retrieve configuration from S3');

        // Should only try once (no retries)
        expect(mockS3Client.send).to.have.been.calledOnce;
        expect(mockLogger.warn).to.not.have.been.called;
      });

      it('does not retry NoSuchKey errors', async () => {
        const noSuchKeyError = new Error('NoSuchKey');
        noSuchKeyError.name = 'NoSuchKey';

        mockS3Client.send.rejects(noSuchKeyError);

        const result = await instance.findLatest();

        expect(result).to.be.null;
        expect(mockS3Client.send).to.have.been.calledOnce;
        expect(mockLogger.warn).to.not.have.been.called;
      });

      it('does not retry DataAccessError', async () => {
        const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
        const daeError = new DataAccessError('Some DAE error', instance);

        mockS3Client.send.rejects(daeError);

        await expect(instance.findLatest())
          .to.be.rejectedWith('Some DAE error');

        expect(mockS3Client.send).to.have.been.calledOnce;
        expect(mockLogger.warn).to.not.have.been.called;
      });
    });

    describe('findByVersion retry behavior', () => {
      it('retries on EBUSY DNS error and succeeds', async () => {
        const ebusyError = new Error('getaddrinfo EBUSY spacecat-prod-importer.s3.us-east-1.amazonaws.com');
        ebusyError.code = 'EBUSY';

        mockS3Client.send
          .onFirstCall().rejects(ebusyError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
          });

        const result = await instance.findByVersion('test-version');

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal('test-version');
        expect(mockS3Client.send).to.have.been.calledTwice;
        expect(mockLogger.warn).to.have.been.calledOnce;
      });

      it('throws after max retries are exhausted', async () => {
        const ebusyError = new Error('getaddrinfo EBUSY');
        ebusyError.code = 'EBUSY';

        mockS3Client.send.rejects(ebusyError);

        await expect(instance.findByVersion('test-version'))
          .to.be.rejectedWith('Failed to retrieve configuration with version');

        expect(mockS3Client.send).to.have.callCount(4);
      });

      it('does not retry NoSuchVersion errors', async () => {
        const noSuchVersionError = new Error('NoSuchVersion');
        noSuchVersionError.name = 'NoSuchVersion';

        mockS3Client.send.rejects(noSuchVersionError);

        const result = await instance.findByVersion('non-existent');

        expect(result).to.be.null;
        expect(mockS3Client.send).to.have.been.calledOnce;
        expect(mockLogger.warn).to.not.have.been.called;
      });
    });

    describe('Exponential backoff timing with jitter', () => {
      it('uses exponential backoff with jitter to prevent thundering herd', async () => {
        // Restore Math.random for this test to verify actual jitter behavior
        randomStub.restore();

        const ebusyError = new Error('EBUSY');
        ebusyError.code = 'EBUSY';

        mockS3Client.send.rejects(ebusyError);

        await expect(instance.findLatest())
          .to.be.rejectedWith('Failed to retrieve configuration from S3');

        // Verify exponential backoff happened (with jitter, delays will vary)
        expect(mockLogger.warn).to.have.been.calledThrice;

        // Extract actual delays from log messages
        const delays = [];
        for (let i = 0; i < 3; i++) {
          const call = mockLogger.warn.getCall(i);
          const match = call.args[0].match(/retrying in (\d+)ms/);
          if (match) {
            delays.push(parseInt(match[1], 10));
          }
        }

        // With base delays of 100, 200, 400 and jitter of ±20%:
        // Attempt 1: ~80-120ms
        // Attempt 2: ~160-240ms
        // Attempt 3: ~320-480ms
        expect(delays[0]).to.be.within(80, 120);
        expect(delays[1]).to.be.within(160, 240);
        expect(delays[2]).to.be.within(320, 480);

        // Re-stub for subsequent tests
        randomStub = stub(Math, 'random').returns(0.5);
      });

      it('works correctly when log is undefined', async () => {
        const ebusyError = new Error('EBUSY');
        ebusyError.code = 'EBUSY';

        // Remove logger
        instance.log = undefined;

        mockS3Client.send
          .onFirstCall().rejects(ebusyError)
          .onSecondCall().resolves({
            Body: createMockS3Body(mockRecord),
            VersionId: 'no-log-version',
          });

        const result = await instance.findLatest();

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal('no-log-version');
        expect(mockS3Client.send).to.have.been.calledTwice;
        // No warning logs should have been attempted
      });
    });
  });
});
