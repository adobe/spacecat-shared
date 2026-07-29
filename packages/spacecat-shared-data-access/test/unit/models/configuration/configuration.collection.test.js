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

  describe('S3 error handling', () => {
    it('returns null when NoSuchKey error occurs in findLatest', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';

      mockS3Client.send.rejects(noSuchKeyError);

      const result = await instance.findLatest();

      expect(result).to.be.null;
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('returns null when NoSuchVersion error occurs in findByVersion', async () => {
      const noSuchVersionError = new Error('NoSuchVersion');
      noSuchVersionError.name = 'NoSuchVersion';

      mockS3Client.send.rejects(noSuchVersionError);

      const result = await instance.findByVersion('non-existent');

      expect(result).to.be.null;
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('wraps S3 errors in DataAccessError for findLatest', async () => {
      const s3Error = new Error('S3 network error');

      mockS3Client.send.rejects(s3Error);

      await expect(instance.findLatest())
        .to.be.rejectedWith('Failed to retrieve configuration from S3');

      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('wraps S3 errors in DataAccessError for findByVersion', async () => {
      const s3Error = new Error('S3 network error');

      mockS3Client.send.rejects(s3Error);

      await expect(instance.findByVersion('test-version'))
        .to.be.rejectedWith('Failed to retrieve configuration with version');

      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      const daeError = new DataAccessError('Original DAE error', instance);

      mockS3Client.send.rejects(daeError);

      await expect(instance.findLatest())
        .to.be.rejectedWith('Original DAE error');

      expect(mockS3Client.send).to.have.been.calledOnce;
    });
  });

  describe('create - S3 user-metadata', () => {
    it('stamps updatedBy/updatedAt into S3 object metadata', async () => {
      mockS3Client.send.resolves({ VersionId: 'v-meta' });

      await instance.create({ ...mockRecord, updatedBy: 'alice@adobe.com' });

      const [command] = mockS3Client.send.firstCall.args;
      expect(command.input.Metadata).to.have.property('updatedby', 'alice@adobe.com');
      expect(command.input.Metadata.updatedat).to.be.a('string');
    });

    it("stamps the default 'system' updatedBy (never a literal 'undefined'/'null')", async () => {
      mockS3Client.send.resolves({ VersionId: 'v-meta-default' });

      await instance.create(mockRecord); // no updatedBy provided

      const [command] = mockS3Client.send.firstCall.args;
      expect(command.input.Metadata.updatedby).to.equal('system');
      expect(command.input.Metadata.updatedby).to.not.match(/undefined|null/);
      expect(command.input.Metadata.updatedat).to.be.a('string').and.not.match(/undefined|null/);
    });
  });

  describe('listVersions', () => {
    const listResponse = (overrides = {}) => ({
      Versions: [
        {
          Key: 'config/spacecat/global-config.json',
          VersionId: 'v2',
          LastModified: new Date('2026-07-23T10:00:00.000Z'),
          IsLatest: true,
          Size: 3000,
        },
        {
          Key: 'config/spacecat/global-config.json',
          VersionId: 'v1',
          LastModified: new Date('2026-07-22T09:00:00.000Z'),
          IsLatest: false,
          Size: 2900,
        },
      ],
      IsTruncated: false,
      ...overrides,
    });

    // Route the shared `send` stub by command type so ListObjectVersions and
    // the per-version HeadObject enrichment can be stubbed independently.
    const routeSend = (listResult, headResultFor) => (command) => {
      const { name } = command.constructor;
      if (name === 'ListObjectVersionsCommand') {
        return Promise.resolve(listResult);
      }
      if (name === 'HeadObjectCommand') {
        return headResultFor(command.input.VersionId);
      }
      return Promise.reject(new Error(`unexpected command ${name}`));
    };

    it('lists versions without enrichment when detail=false', async () => {
      mockS3Client.send.callsFake(routeSend(listResponse(), () => {
        throw new Error('HeadObject should not be called');
      }));

      const result = await instance.listVersions({ detail: false });

      expect(result.versions).to.have.length(2);
      expect(result.versions[0]).to.deep.equal({
        versionId: 'v2',
        lastModified: '2026-07-23T10:00:00.000Z',
        isLatest: true,
        size: 3000,
      });
      expect(result.isTruncated).to.be.false;
      expect(result.nextKeyMarker).to.be.null;
      expect(result.nextVersionIdMarker).to.be.null;
      expect(mockS3Client.send).to.have.been.calledOnce;
    });

    it('enriches each version with updatedBy/updatedAt from S3 metadata by default', async () => {
      const meta = {
        v2: { Metadata: { updatedby: 'bob@adobe.com', updatedat: '2026-07-23T10:00:00.000Z' } },
        v1: { Metadata: { updatedby: 'alice@adobe.com', updatedat: '2026-07-22T09:00:00.000Z' } },
      };
      mockS3Client.send.callsFake(
        routeSend(listResponse(), (vid) => Promise.resolve(meta[vid])),
      );

      const result = await instance.listVersions();

      expect(result.versions[0].updatedBy).to.equal('bob@adobe.com');
      expect(result.versions[1].updatedBy).to.equal('alice@adobe.com');
      // 1 list + 2 heads
      expect(mockS3Client.send.callCount).to.equal(3);
    });

    it('enriches in bounded batches when the page exceeds ENRICH_CONCURRENCY', async () => {
      // 60 versions > the batch size (25) → exercises the multi-batch loop.
      const many = Array.from({ length: 60 }, (_, i) => ({
        Key: 'config/spacecat/global-config.json',
        VersionId: `v${i}`,
        LastModified: new Date('2026-07-23T10:00:00.000Z'),
        IsLatest: i === 0,
        Size: 100,
      }));
      let concurrent = 0;
      let peak = 0;
      mockS3Client.send.callsFake((command) => {
        if (command.constructor.name === 'ListObjectVersionsCommand') {
          return Promise.resolve({ Versions: many, IsTruncated: false });
        }
        concurrent += 1;
        peak = Math.max(peak, concurrent);
        return new Promise((resolve) => {
          setImmediate(() => {
            concurrent -= 1;
            resolve({ Metadata: { updatedby: 'x', updatedat: 'y' } });
          });
        });
      });

      const result = await instance.listVersions({ limit: 100 });

      expect(result.versions).to.have.length(60);
      expect(result.versions.every((v) => v.updatedBy === 'x')).to.be.true;
      // Fan-out never exceeds the batch cap, regardless of page size.
      expect(peak).to.be.at.most(25);
    });

    it('falls back to null when a version has no user-metadata', async () => {
      mockS3Client.send.callsFake(
        routeSend(listResponse(), () => Promise.resolve({ Metadata: undefined })),
      );

      const result = await instance.listVersions();

      expect(result.versions[0].updatedBy).to.be.null;
      expect(result.versions[0].updatedAt).to.be.null;
    });

    it('degrades to null and warns (not errors) when a version was reaped between list and head', async () => {
      const gone = new Error('NoSuchVersion');
      gone.name = 'NoSuchVersion';
      mockS3Client.send.callsFake(
        routeSend(listResponse(), () => Promise.reject(gone)),
      );

      const result = await instance.listVersions();

      expect(result.versions[0].updatedBy).to.be.null;
      expect(mockLogger.warn).to.have.been.called;
      expect(mockLogger.error).to.not.have.been.called;
    });

    it('degrades to null but logs at error on a systemic head failure (e.g. AccessDenied)', async () => {
      const denied = new Error('Access Denied');
      denied.name = 'AccessDenied';
      mockS3Client.send.callsFake(
        routeSend(listResponse(), () => Promise.reject(denied)),
      );

      const result = await instance.listVersions();

      expect(result.versions[0].updatedBy).to.be.null;
      // A page that comes back all-null must read as an outage, not "old versions".
      expect(mockLogger.error).to.have.been.called;
    });

    it('passes pagination markers and surfaces the next markers', async () => {
      mockS3Client.send.callsFake(routeSend(
        listResponse({
          IsTruncated: true,
          NextKeyMarker: 'config/spacecat/global-config.json',
          NextVersionIdMarker: 'v1',
        }),
        () => Promise.resolve({ Metadata: {} }),
      ));

      const result = await instance.listVersions({
        limit: 2,
        keyMarker: 'km',
        versionIdMarker: 'vm',
        detail: false,
      });

      const [command] = mockS3Client.send.firstCall.args;
      expect(command.input.MaxKeys).to.equal(2);
      expect(command.input.KeyMarker).to.equal('km');
      expect(command.input.VersionIdMarker).to.equal('vm');
      expect(result.isTruncated).to.be.true;
      expect(result.nextKeyMarker).to.equal('config/spacecat/global-config.json');
      expect(result.nextVersionIdMarker).to.equal('v1');
    });

    it('degrades to null on a head failure with no error name', async () => {
      const nameless = new Error('nameless');
      nameless.name = '';
      mockS3Client.send.callsFake(
        routeSend(listResponse(), () => Promise.reject(nameless)),
      );

      const result = await instance.listVersions();

      expect(result.versions[0].updatedBy).to.be.null;
      expect(mockLogger.error).to.have.been.calledWithMatch(/\(Error\): nameless/);
    });

    it('clamps MaxKeys into [1, 1000] and defaults an unparseable limit to 25', async () => {
      mockS3Client.send.callsFake(
        routeSend(listResponse(), () => Promise.resolve({ Metadata: {} })),
      );

      await instance.listVersions({ limit: 99999, detail: false });
      expect(mockS3Client.send.firstCall.args[0].input.MaxKeys).to.equal(1000);

      mockS3Client.send.resetHistory();
      await instance.listVersions({ limit: -5, detail: false });
      expect(mockS3Client.send.firstCall.args[0].input.MaxKeys).to.equal(1);

      mockS3Client.send.resetHistory();
      await instance.listVersions({ limit: 'not-a-number', detail: false });
      expect(mockS3Client.send.firstCall.args[0].input.MaxKeys).to.equal(25);
    });

    it('handles a missing Versions array and non-Date lastModified', async () => {
      mockS3Client.send.callsFake(routeSend({
        Versions: [
          {
            Key: 'config/spacecat/global-config.json',
            VersionId: 'v-str',
            LastModified: '2026-07-23T10:00:00.000Z',
            IsLatest: true,
            Size: 1,
          },
          // Not the config key — must be filtered out.
          { Key: 'other/key.json', VersionId: 'x', IsLatest: false },
        ],
      }, () => Promise.resolve({ Metadata: {} })));

      const result = await instance.listVersions({ detail: false });

      expect(result.versions).to.have.length(1);
      expect(result.versions[0].versionId).to.equal('v-str');
      expect(result.versions[0].lastModified).to.equal('2026-07-23T10:00:00.000Z');
    });

    it('returns empty list when S3 returns no Versions', async () => {
      mockS3Client.send.callsFake(routeSend({ IsTruncated: false }, () => {}));

      const result = await instance.listVersions({ detail: false });

      expect(result.versions).to.deep.equal([]);
    });

    it('throws when S3 is not configured', async () => {
      instance.s3Client = undefined;
      instance.s3Bucket = undefined;

      await expect(instance.listVersions())
        .to.be.rejectedWith('S3 configuration is required for Configuration storage');
    });

    it('wraps S3 errors in DataAccessError', async () => {
      mockS3Client.send.rejects(new Error('S3 list error'));

      await expect(instance.listVersions({ detail: false }))
        .to.be.rejectedWith('Failed to list configuration versions from S3');
    });

    it('rethrows DataAccessError without wrapping', async () => {
      const { default: DataAccessError } = await import('../../../../src/errors/data-access.error.js');
      mockS3Client.send.rejects(new DataAccessError('Original list DAE', instance));

      await expect(instance.listVersions({ detail: false }))
        .to.be.rejectedWith('Original list DAE');
    });
  });
});
