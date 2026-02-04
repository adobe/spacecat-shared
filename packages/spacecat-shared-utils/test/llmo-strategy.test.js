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
  strategyPath,
  readStrategy,
  writeStrategy,
} from '../src/llmo-strategy.js';

use(sinonChai);
use(chaiAsPromised);

describe('llmo-strategy utilities', () => {
  const originalBucket = process.env.S3_BUCKET_NAME;
  const siteId = 'test-site-id';

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

  describe('strategyPath', () => {
    it('builds the strategy file path', () => {
      expect(strategyPath(siteId)).to.equals(`workspace/llmo/${siteId}/strategy.json`);
    });
  });

  describe('readStrategy', () => {
    it('retrieves and parses the strategy from S3', async () => {
      const strategyData = { foo: 'bar', nested: { key: 123 } };
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(strategyData)),
      };
      s3Client.send.resolves({ Body: body });

      const result = await readStrategy(siteId, s3Client);

      expect(result).deep.equals({ data: strategyData, exists: true, version: undefined });
      expect(s3Client.send).calledOnce;
      const command = s3Client.send.firstCall.args[0];
      expect(command).instanceOf(GetObjectCommand);
      expect(command.input.Bucket).equals('default-test-bucket');
      expect(command.input.Key).equals(`workspace/llmo/${siteId}/strategy.json`);
      expect(command.input.VersionId).undefined;
      expect(body.transformToString).calledOnce;
    });

    it('uses provided bucket and version when options are set', async () => {
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify({ test: true })),
      };
      s3Client.send.resolves({ Body: body });

      await readStrategy(siteId, s3Client, {
        version: 'abc123',
        s3Bucket: 'custom-bucket',
      });

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).equals('custom-bucket');
      expect(command.input.VersionId).equals('abc123');
    });

    it('returns version ID when S3 response includes VersionId', async () => {
      const strategyData = { example: 'data' };
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(strategyData)),
      };
      s3Client.send.resolves({ Body: body, VersionId: 'v123' });

      const result = await readStrategy(siteId, s3Client);

      expect(result).deep.equals({ data: strategyData, exists: true, version: 'v123' });
    });

    it('returns null data when the file does not exist', async () => {
      const error = new Error('Missing key');
      error.name = 'NoSuchKey';
      s3Client.send.rejects(error);

      const result = await readStrategy(siteId, s3Client);

      expect(result.exists).equals(false);
      expect(result.data).equals(null);
      expect(result.version).equals(undefined);
    });

    it('returns null data when NotFound error is thrown', async () => {
      const error = new Error('Not found');
      error.name = 'NotFound';
      s3Client.send.rejects(error);

      const result = await readStrategy(siteId, s3Client);

      expect(result.exists).equals(false);
      expect(result.data).equals(null);
    });

    it('re-throws unexpected S3 errors', async () => {
      s3Client.send.rejects(new Error('Boom'));

      await expect(readStrategy(siteId, s3Client)).rejectedWith('Boom');
    });

    it('throws when the S3 object body is missing', async () => {
      s3Client.send.resolves({});

      await expect(readStrategy(siteId, s3Client)).rejectedWith('Strategy body is empty');
    });

    it('throws when the S3 object body cannot be parsed', async () => {
      const body = {
        transformToString: sinon.stub().resolves('not valid json'),
      };
      s3Client.send.resolves({ Body: body });

      await expect(readStrategy(siteId, s3Client)).rejectedWith(SyntaxError);
    });

    it('accepts any valid JSON structure without schema validation', async () => {
      // This should work with any arbitrary structure - no schema validation
      const arbitraryData = {
        randomField: 'value',
        numbers: [1, 2, 3],
        deeply: { nested: { structure: { works: true } } },
        nullValue: null,
        booleans: false,
      };
      const body = {
        transformToString: sinon.stub().resolves(JSON.stringify(arbitraryData)),
      };
      s3Client.send.resolves({ Body: body });

      const result = await readStrategy(siteId, s3Client);

      expect(result.data).deep.equals(arbitraryData);
      expect(result.exists).equals(true);
    });
  });

  describe('writeStrategy', () => {
    it('writes the strategy to the default S3 bucket', async () => {
      const strategyData = { key: 'value', count: 42 };
      s3Client.send.resolves({ VersionId: 'v1' });

      const result = await writeStrategy(siteId, strategyData, s3Client);

      expect(result).deep.equals({ version: 'v1' });
      expect(s3Client.send).calledOnce;
      const command = s3Client.send.firstCall.args[0];
      expect(command).instanceOf(PutObjectCommand);
      expect(command.input.Bucket).equals('default-test-bucket');
      expect(command.input.Key).equals(`workspace/llmo/${siteId}/strategy.json`);
      expect(command.input.Body).equals(JSON.stringify(strategyData, null, 2));
      expect(command.input.ContentType).equals('application/json');
    });

    it('writes the strategy to a provided bucket', async () => {
      s3Client.send.resolves({ VersionId: 'v2' });

      await writeStrategy(siteId, { test: true }, s3Client, { s3Bucket: 'custom-bucket' });

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).equals('custom-bucket');
    });

    it('throws when S3 does not return a version id', async () => {
      s3Client.send.resolves({});

      await expect(writeStrategy(siteId, { data: 'test' }, s3Client)).rejectedWith('Failed to get version ID after writing strategy');
    });

    it('writes any arbitrary JSON structure', async () => {
      const arbitraryData = {
        anything: 'goes',
        arrays: [{ nested: 'objects' }],
        unicode: '日本語テスト',
      };
      s3Client.send.resolves({ VersionId: 'v3' });

      const result = await writeStrategy(siteId, arbitraryData, s3Client);

      expect(result).deep.equals({ version: 'v3' });
      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Body).equals(JSON.stringify(arbitraryData, null, 2));
    });
  });
});
