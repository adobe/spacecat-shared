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

import { Readable } from 'stream';
import { sdkStreamMixin } from '@smithy/util-stream';

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Configuration from '../../../../src/models/configuration/configuration.model.js';
import ConfigurationCollection from '../../../../src/models/configuration/configuration.collection.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

// Helper to create a mock S3 response body
const createMockS3Body = (data) => {
  const stream = new Readable();
  stream.push(JSON.stringify(data));
  stream.push(null);
  return sdkStreamMixin(stream);
};

describe('ConfigurationCollection', () => {
  let instance;
  let mockS3Client;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    configurationId: '2e6d24e8-3a1f-4c2c-9f80-696a177ff699',
    queues: {
      someQueue: {},
    },
    jobs: [],
    version: 1,
  };

  beforeEach(() => {
    mockS3Client = {
      send: stub(),
    };

    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Configuration, mockRecord));

    // Add S3 config to the instance
    instance.s3Client = mockS3Client;
    instance.s3Bucket = 'test-bucket';
  });

  describe('constructor', () => {
    it('initializes the ConfigurationCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(instance.s3Client).to.equal(mockS3Client);
      expect(instance.s3Bucket).to.equal('test-bucket');

      expect(model).to.be.an('object');
    });

    it('initializes without S3 config when not provided', () => {
      const collectionWithoutS3 = new ConfigurationCollection(
        mockElectroService,
        mockEntityRegistry,
        schema,
        mockLogger,
      );

      expect(collectionWithoutS3.s3Client).to.be.undefined;
      expect(collectionWithoutS3.s3Bucket).to.be.undefined;
    });

    it('initializes with S3 config when provided', () => {
      const s3Config = { s3Client: mockS3Client, s3Bucket: 'my-bucket' };
      const collectionWithS3 = new ConfigurationCollection(
        mockElectroService,
        mockEntityRegistry,
        schema,
        mockLogger,
        s3Config,
      );

      expect(collectionWithS3.s3Client).to.equal(mockS3Client);
      expect(collectionWithS3.s3Bucket).to.equal('my-bucket');
    });
  });

  describe('create', () => {
    it('creates a new configuration as first version in S3', async () => {
      // First call to findLatest returns null (no existing config)
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.onFirstCall().rejects(noSuchKeyError);
      // Second call is the PutObject
      mockS3Client.send.onSecondCall().resolves({});

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(1);
      expect(mockS3Client.send).to.have.been.calledTwice;
    });

    it('creates a new configuration as a new version in S3', async () => {
      const existingConfig = { ...mockRecord, version: 1 };
      // First call to findLatest returns existing config
      mockS3Client.send.onFirstCall().resolves({
        Body: createMockS3Body(existingConfig),
      });
      // Second call is the PutObject
      mockS3Client.send.onSecondCall().resolves({});

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(2);
      expect(mockS3Client.send).to.have.been.calledTwice;
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.create(mockRecord))
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 put fails', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.onFirstCall().rejects(noSuchKeyError);
      mockS3Client.send.onSecondCall().rejects(new Error('S3 error'));

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
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.onFirstCall().rejects(noSuchKeyError);

      const invalidConfig = {
        // Missing required 'queues' field
        jobs: [],
      };

      await expect(instance.create(invalidConfig))
        .to.be.rejectedWith('Configuration validation error');
    });
  });

  describe('findByVersion', () => {
    it('finds configuration by S3 version ID (string)', async () => {
      const versionId = 'abc123-version-id';
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findByVersion(versionId);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockRecord.version);
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('finds configuration by version number (casts to string)', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findByVersion(3);

      expect(result).to.be.an('object');
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('returns null when version not found', async () => {
      const noSuchVersionError = new Error('NoSuchVersion');
      noSuchVersionError.name = 'NoSuchVersion';
      mockS3Client.send.rejects(noSuchVersionError);

      const result = await instance.findByVersion('non-existent-version');

      expect(result).to.be.null;
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.findByVersion('some-version'))
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 get fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.findByVersion('some-version'))
        .to.be.rejectedWith('Failed to retrieve configuration version');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.findByVersion('some-version'))
        .to.be.rejectedWith('Original error');
    });
  });

  describe('findLatest', () => {
    it('returns the latest configuration from S3', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findLatest();

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockRecord.version);
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('returns null when no configuration exists in S3', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.rejects(noSuchKeyError);

      const result = await instance.findLatest();

      expect(result).to.be.null;
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.findLatest())
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 get fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.findLatest())
        .to.be.rejectedWith('Failed to retrieve configuration from S3');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.findLatest())
        .to.be.rejectedWith('Original error');
    });
  });
});
