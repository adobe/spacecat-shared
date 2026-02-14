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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import { getDataAccess, isPostgres } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

/**
 * Creates a mock S3 response body without using sdkStreamMixin.
 * @param {object} data - The data to return as JSON.
 * @returns {object} Mock body with transformToString method.
 */
const createMockS3Body = (data) => ({
  transformToString: async () => JSON.stringify(data),
});

describe('Configuration IT', async () => {
  let Configuration;
  let mockS3Client;
  let s3Storage; // Stores configurations by VersionId

  // Sample configuration data for testing
  const sampleConfigData = {
    queues: {
      audits: 'audit-queue-url',
      imports: 'import-queue-url',
    },
    jobs: [
      {
        group: 'audits',
        type: 'cwv',
        interval: 'daily',
      },
    ],
    handlers: {
      cwv: {
        enabledByDefault: true,
        dependencies: [],
        disabled: { sites: [], orgs: [] },
        enabled: { sites: [], orgs: [] },
        productCodes: ['CDN'],
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  before(async function () {
    if (isPostgres()) {
      this.skip();
      return;
    }
    this.timeout(10000);
    await seedDatabase();

    const dataAccess = getDataAccess();
    Configuration = dataAccess.Configuration;
  });

  beforeEach(() => {
    // Reset S3 storage for each test
    s3Storage = new Map();

    // Create mock S3 client
    mockS3Client = {
      send: sinon.stub().callsFake(async (command) => {
        const commandName = command.constructor.name;

        if (commandName === 'PutObjectCommand') {
          const versionId = `version-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const configData = JSON.parse(command.input.Body);
          s3Storage.set(versionId, configData);
          return { VersionId: versionId };
        }

        if (commandName === 'GetObjectCommand') {
          const { VersionId } = command.input;

          if (VersionId) {
            // Fetch specific version
            const data = s3Storage.get(VersionId);
            if (!data) {
              const error = new Error('NoSuchVersion');
              error.name = 'NoSuchVersion';
              throw error;
            }
            return { Body: createMockS3Body(data), VersionId };
          }

          // Fetch latest version
          if (s3Storage.size === 0) {
            const error = new Error('NoSuchKey');
            error.name = 'NoSuchKey';
            throw error;
          }
          const latestVersionId = Array.from(s3Storage.keys()).pop();
          return {
            Body: createMockS3Body(s3Storage.get(latestVersionId)),
            VersionId: latestVersionId,
          };
        }

        return {};
      }),
    };

    // Inject mock S3 client into Configuration collection
    Configuration.s3Client = mockS3Client;
    Configuration.s3Bucket = 'test-bucket';
  });

  afterEach(() => {
    sinon.restore();
  });

  it('creates a new configuration in S3', async () => {
    const configuration = await Configuration.create(sampleConfigData);

    expect(configuration).to.be.an('object');
    expect(configuration.getId()).to.be.a('string');
    expect(s3Storage.size).to.equal(1);
  });

  it('finds the latest configuration', async () => {
    // Create a configuration first
    const created = await Configuration.create(sampleConfigData);

    const configuration = await Configuration.findLatest();

    expect(configuration).to.be.an('object');
    expect(configuration.getId()).to.equal(created.getId());
  });

  it('finds configuration by version (S3 VersionId)', async () => {
    const created = await Configuration.create(sampleConfigData);
    const versionId = created.getId();

    const configuration = await Configuration.findByVersion(versionId);

    expect(configuration).to.be.an('object');
    expect(configuration.getId()).to.equal(versionId);
  });

  it('returns null when configuration version not found', async () => {
    const configuration = await Configuration.findByVersion('non-existent-version');

    expect(configuration).to.be.null;
  });

  it('returns null when no configuration exists', async () => {
    const configuration = await Configuration.findLatest();

    expect(configuration).to.be.null;
  });

  it('updates a configuration (creates new version)', async () => {
    const configuration = await Configuration.create(sampleConfigData);
    const originalId = configuration.getId();

    const handlerData = {
      enabledByDefault: true,
      dependencies: [],
      disabled: { sites: [], orgs: [] },
      enabled: { sites: ['site1'], orgs: ['org1'] },
      productCodes: ['ASO'],
    };

    configuration.addHandler('test', handlerData);
    await configuration.save();

    // A new version should be created
    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getId()).to.not.equal(originalId);
    expect(updatedConfiguration.getHandler('test')).to.deep.equal(handlerData);
    expect(s3Storage.size).to.equal(2);
  });

  it('registers a new audit handler', async () => {
    await Configuration.create(sampleConfigData);

    const configuration = await Configuration.findLatest();
    configuration.registerAudit('structured-data', true, 'weekly', ['LLMO']);
    await configuration.save();

    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getHandler('structured-data')).to.deep.equal({
      enabledByDefault: true,
      dependencies: [],
      disabled: { sites: [], orgs: [] },
      enabled: { sites: [], orgs: [] },
      productCodes: ['LLMO'],
    });
  });

  it('unregisters an audit handler', async () => {
    // Create config with a handler
    const configWithHandler = {
      ...sampleConfigData,
      handlers: {
        ...sampleConfigData.handlers,
        'structured-data': {
          enabledByDefault: true,
          dependencies: [],
          disabled: { sites: [], orgs: [] },
          enabled: { sites: [], orgs: [] },
          productCodes: ['LLMO'],
        },
      },
    };
    await Configuration.create(configWithHandler);

    const configuration = await Configuration.findLatest();
    expect(configuration.getHandler('structured-data')).to.not.be.undefined;

    configuration.unregisterAudit('structured-data');
    await configuration.save();

    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getHandler('structured-data')).to.be.undefined;
  });
});
