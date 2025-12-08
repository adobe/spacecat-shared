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
});
