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

import Configuration from '../../../../src/models/configuration/configuration.model.js';
import ConfigurationCollection from '../../../../src/models/configuration/configuration.collection.js';

import { createElectroMocks } from '../../util.js';

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
    it('creates a new configuration in S3 and captures VersionId', async () => {
      mockS3Client.send.resolves({ VersionId: 'new-version-id-123' });

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(1);
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

  describe('findById', () => {
    it('finds configuration by S3 version ID and sets configurationId', async () => {
      const versionId = 'abc123-version-id';
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findById(versionId);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockRecord.version);
      expect(result.getId()).to.equal(versionId);
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('returns null when version not found (NoSuchKey)', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.rejects(noSuchKeyError);

      const result = await instance.findById('non-existent-version');

      expect(result).to.be.null;
    });

    it('returns null when version not found (NoSuchVersion)', async () => {
      const noSuchVersionError = new Error('NoSuchVersion');
      noSuchVersionError.name = 'NoSuchVersion';
      mockS3Client.send.rejects(noSuchVersionError);

      const result = await instance.findById('non-existent-version');

      expect(result).to.be.null;
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.findById('some-version'))
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 get fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.findById('some-version'))
        .to.be.rejectedWith('Failed to retrieve configuration with ID');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.findById('some-version'))
        .to.be.rejectedWith('Original error');
    });
  });

  describe('findByVersion', () => {
    it('is an alias for findById', async () => {
      const versionId = 'abc123-version-id';
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.findByVersion(versionId);

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(versionId);
      expect(mockS3Client.send).to.have.been.calledOnce;
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
      expect(result.getVersion()).to.equal(mockRecord.version);
      expect(result.getId()).to.equal('latest-version-id');
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

  describe('findByAll', () => {
    it('is an alias for findLatest', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
        VersionId: 'latest-version-id',
      });

      const result = await instance.findByAll();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal('latest-version-id');
    });
  });

  describe('all', () => {
    it('returns all configuration versions from S3', async () => {
      // First call - ListObjectVersions
      mockS3Client.send.onFirstCall().resolves({
        Versions: [
          { VersionId: 'version-1', IsDeleteMarker: false },
          { VersionId: 'version-2', IsDeleteMarker: false },
          { VersionId: 'version-3', IsDeleteMarker: true }, // Should be filtered out
        ],
      });
      // Subsequent calls - GetObject for each version
      mockS3Client.send.onSecondCall().resolves({
        Body: createMockS3Body({ ...mockRecord, version: 1 }),
      });
      mockS3Client.send.onThirdCall().resolves({
        Body: createMockS3Body({ ...mockRecord, version: 2 }),
      });

      const result = await instance.all();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].getId()).to.equal('version-1');
      expect(result[1].getId()).to.equal('version-2');
    });

    it('returns empty array when no versions exist', async () => {
      mockS3Client.send.resolves({ Versions: [] });

      const result = await instance.all();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('returns empty array when Versions is undefined', async () => {
      mockS3Client.send.resolves({});

      const result = await instance.all();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.all())
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 list fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.all())
        .to.be.rejectedWith('Failed to list configuration versions from S3');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.all())
        .to.be.rejectedWith('Original error');
    });
  });

  describe('existsById', () => {
    it('returns true when configuration exists', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
      });

      const result = await instance.existsById('some-version-id');

      expect(result).to.be.true;
    });

    it('returns false when configuration does not exist', async () => {
      const noSuchVersionError = new Error('NoSuchVersion');
      noSuchVersionError.name = 'NoSuchVersion';
      mockS3Client.send.rejects(noSuchVersionError);

      const result = await instance.existsById('non-existent-version');

      expect(result).to.be.false;
    });
  });

  describe('exists', () => {
    it('returns true when any configuration exists', async () => {
      mockS3Client.send.resolves({
        Body: createMockS3Body(mockRecord),
        VersionId: 'some-version',
      });

      const result = await instance.exists();

      expect(result).to.be.true;
    });

    it('returns false when no configuration exists', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockS3Client.send.rejects(noSuchKeyError);

      const result = await instance.exists();

      expect(result).to.be.false;
    });
  });

  describe('removeByIds', () => {
    it('removes configuration versions by IDs', async () => {
      mockS3Client.send.resolves({ Deleted: [{ VersionId: 'v1' }, { VersionId: 'v2' }] });

      await instance.removeByIds(['v1', 'v2']);

      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('logs warning when some deletions fail', async () => {
      mockS3Client.send.resolves({
        Deleted: [{ VersionId: 'v1' }],
        Errors: [{ VersionId: 'v2', Code: 'AccessDenied' }],
      });

      await instance.removeByIds(['v1', 'v2']);

      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('throws error when ids is not an array', async () => {
      await expect(instance.removeByIds('not-an-array'))
        .to.be.rejectedWith('ids must be a non-empty array');
    });

    it('throws error when ids is empty', async () => {
      await expect(instance.removeByIds([]))
        .to.be.rejectedWith('ids must be a non-empty array');
    });

    it('throws error when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.removeByIds(['v1']))
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('throws error when S3 delete fails', async () => {
      mockS3Client.send.rejects(new Error('S3 error'));

      await expect(instance.removeByIds(['v1']))
        .to.be.rejectedWith('Failed to delete configuration versions from S3');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const originalError = new DataAccessError('Original error', instance);
      mockS3Client.send.rejects(originalError);

      await expect(instance.removeByIds(['v1']))
        .to.be.rejectedWith('Original error');
    });
  });

  describe('unsupported methods', () => {
    it('createMany throws error', async () => {
      await expect(instance.createMany([{}]))
        .to.be.rejectedWith('createMany() is not supported for Configuration');
    });

    it('_saveMany throws error', async () => {
      // eslint-disable-next-line no-underscore-dangle
      await expect(instance._saveMany([{}]))
        .to.be.rejectedWith('_saveMany() is not supported for Configuration');
    });

    it('batchGetByKeys throws error', async () => {
      await expect(instance.batchGetByKeys([{}]))
        .to.be.rejectedWith('batchGetByKeys() is not supported for Configuration');
    });

    it('allByIndexKeys throws error', async () => {
      await expect(instance.allByIndexKeys({}))
        .to.be.rejectedWith('allByIndexKeys() is not supported for Configuration');
    });

    it('findByIndexKeys throws error', async () => {
      await expect(instance.findByIndexKeys({}))
        .to.be.rejectedWith('findByIndexKeys() is not supported for Configuration');
    });

    it('removeByIndexKeys throws error', async () => {
      await expect(instance.removeByIndexKeys([{}]))
        .to.be.rejectedWith('removeByIndexKeys() is not supported for Configuration');
    });
  });
});
