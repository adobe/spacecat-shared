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

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  lmmoConfigDir,
  llmoConfigPath,
  defaultConfig,
  readConfig,
  writeConfig,
} from '../src/llmo-config.js';

use(sinonChai);
use(chaiAsPromised);

describe('llmo-config utilities', () => {
  const originalBucket = process.env.S3_BUCKET_NAME;
  const siteId = 'test-site-id';
  const validConfig = defaultConfig();

  let s3Client;

  beforeEach(() => {
    process.env.S3_BUCKET_NAME = 'default-test-bucket';
    s3Client = sinon.createStubInstance(S3Client);
  });

  afterEach(() => {
    sinon.restore();
    if (originalBucket === undefined) {
      delete process.env.S3_BUCKET_NAME;
    } else {
      process.env.S3_BUCKET_NAME = originalBucket;
    }
  });

  describe('path helpers', () => {
    it('builds the config directory path', () => {
      expect(lmmoConfigDir(siteId)).to.equals(`config/llmo/${siteId}`);
    });

    it('builds the config file path', () => {
      expect(llmoConfigPath(siteId)).to.equals(`config/llmo/${siteId}/lmmo-config.json`);
    });
  });

  describe('defaultConfig', () => {
    it('returns the expected empty configuration structure', () => {
      expect(defaultConfig()).to.deep.equals({
        entities: {},
        categories: {},
        topics: {},
        brands: {
          aliases: [],
        },
        competitors: {
          competitors: [],
        },
        deleted: {
          prompts: {},
          topics: {},
          categories: {},
        },
      });
    });
  });

  describe('readConfig', () => {
    it('retrieves and parses the configuration from S3', async () => {
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(validConfig)),
      };
      s3Client.send.resolves({ Body: body });

      const result = await readConfig(siteId, s3Client);

      expect(result).deep.equals({ config: validConfig, exists: true, version: undefined });
      expect(s3Client.send).calledOnce;
      const command = s3Client.send.firstCall.args[0];
      expect(command).instanceOf(GetObjectCommand);
      expect(command.input.Bucket).equals('default-test-bucket');
      expect(command.input.Key).equals(`config/llmo/${siteId}/lmmo-config.json`);
      expect(command.input.VersionId).undefined;
      expect(body.transformToString).calledOnce;
    });

    it('uses provided bucket and version when options are set', async () => {
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(validConfig)),
      };
      s3Client.send.resolves({ Body: body });

      await readConfig(siteId, s3Client, {
        version: 'abc123',
        s3Bucket: 'custom-bucket',
      });

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).equals('custom-bucket');
      expect(command.input.VersionId).equals('abc123');
    });

    it('returns version ID when S3 response includes VersionId', async () => {
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(validConfig)),
      };
      s3Client.send.resolves({ Body: body, VersionId: 'v123' });

      const result = await readConfig(siteId, s3Client);

      expect(result).deep.equals({ config: validConfig, exists: true, version: 'v123' });
    });

    it('returns default config when the file does not exist', async () => {
      const error = new Error('Missing key');
      error.name = 'NoSuchKey';
      s3Client.send.rejects(error);

      const result = await readConfig(siteId, s3Client);

      expect(result.exists).equals(false);
      expect(result.config).deep.equals(defaultConfig());
    });

    it('re-throws unexpected S3 errors', async () => {
      s3Client.send.rejects(new Error('Boom'));

      await expect(readConfig(siteId, s3Client)).rejectedWith('Boom');
    });

    it('throws when the S3 object body is missing', async () => {
      s3Client.send.resolves({});

      await expect(readConfig(siteId, s3Client)).rejectedWith('LLMO config body is empty');
    });

    it('throws when the S3 object body cannot be parsed', async () => {
      const body = {
        transformToString: sinon.stub().resolves('not valid json'),
      };
      s3Client.send.resolves({ Body: body });

      await expect(readConfig(siteId, s3Client)).rejectedWith(SyntaxError);
    });

    it('throws when the configuration fails schema validation', async () => {
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify({ entities: {} })),
      };
      s3Client.send.resolves({ Body: body });

      await expect(readConfig(siteId, s3Client)).rejectedWith(Error);
    });
  });

  describe('writeConfig', () => {
    it('writes the configuration to the default S3 bucket', async () => {
      s3Client.send.resolves({ VersionId: 'v1' });

      const result = await writeConfig(siteId, validConfig, s3Client);

      expect(result).deep.equals({ version: 'v1' });
      expect(s3Client.send).calledOnce;
      const command = s3Client.send.firstCall.args[0];
      expect(command).instanceOf(PutObjectCommand);
      expect(command.input.Bucket).equals('default-test-bucket');
      expect(command.input.Key).equals(`config/llmo/${siteId}/lmmo-config.json`);
      expect(command.input.Body).equals(JSON.stringify(validConfig, null, 2));
      expect(command.input.ContentType).equals('application/json');
    });

    it('writes the configuration to a provided bucket', async () => {
      s3Client.send.resolves({ VersionId: 'v2' });

      await writeConfig(siteId, validConfig, s3Client, { s3Bucket: 'custom-bucket' });

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).equals('custom-bucket');
    });

    it('throws when S3 does not return a version id', async () => {
      s3Client.send.resolves({});

      await expect(writeConfig(siteId, validConfig, s3Client)).rejectedWith('Failed to get version ID after writing LLMO config');
    });
  });
});
