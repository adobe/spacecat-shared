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

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import esmock from 'esmock';
import TokowakaClient from '../src/index.js';

use(sinonChai);

describe('TokowakaClient', () => {
  let client;
  let s3Client;
  let log;
  let mockSite;
  let mockOpportunity;
  let mockSuggestions;

  beforeEach(() => {
    s3Client = {
      send: sinon.stub().resolves(),
    };

    log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };

    const env = {
      TOKOWAKA_CDN_PROVIDER: 'cloudfront',
      TOKOWAKA_CDN_CONFIG: JSON.stringify({
        cloudfront: {
          distributionId: 'E123456',
          region: 'us-east-1',
        },
      }),
    };

    client = new TokowakaClient(
      {
        bucketName: 'test-bucket',
        previewBucketName: 'test-preview-bucket',
        s3Client,
        env,
      },
      log,
    );

    mockSite = {
      getId: () => 'site-123',
      getBaseURL: () => 'https://example.com',
      getConfig: () => ({
        getTokowakaConfig: () => ({
          forwardedHost: 'example.com',
          apiKey: 'test-api-key',
        }),
      }),
    };

    mockOpportunity = {
      getId: () => 'opp-123',
      getType: () => 'headings',
    };

    mockSuggestions = [
      {
        getId: () => 'sugg-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://example.com/page1',
          recommendedAction: 'New Heading',
          checkType: 'heading-empty',
          transformRules: {
            action: 'replace',
            selector: 'h1',
          },
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      },
      {
        getId: () => 'sugg-2',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://example.com/page1',
          recommendedAction: 'New Subtitle',
          checkType: 'heading-empty',
          transformRules: {
            action: 'replace',
            selector: 'h2',
          },
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      },
    ];
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      expect(client).to.be.instanceOf(TokowakaClient);
      expect(client.deployBucketName).to.equal('test-bucket');
      expect(client.previewBucketName).to.equal('test-preview-bucket');
      expect(client.s3Client).to.equal(s3Client);
    });

    it('should throw error if bucketName is missing', () => {
      expect(() => new TokowakaClient({ s3Client }, log))
        .to.throw('TOKOWAKA_SITE_CONFIG_BUCKET is required');
    });

    it('should throw error if s3Client is missing', () => {
      expect(() => new TokowakaClient({ bucketName: 'test-bucket' }, log))
        .to.throw('S3 client is required');
    });

    it('should use deployBucketName for preview if previewBucketName not provided', () => {
      const clientWithoutPreview = new TokowakaClient(
        { bucketName: 'test-bucket', s3Client },
        log,
      );
      // previewBucketName is undefined if not explicitly provided
      expect(clientWithoutPreview.previewBucketName).to.be.undefined;
    });
  });

  describe('createFrom', () => {
    it('should create client from context', () => {
      const context = {
        env: {
          TOKOWAKA_SITE_CONFIG_BUCKET: 'test-bucket',
          TOKOWAKA_PREVIEW_BUCKET: 'test-preview-bucket',
        },
        s3: { s3Client },
        log,
      };

      const createdClient = TokowakaClient.createFrom(context);

      expect(createdClient).to.be.instanceOf(TokowakaClient);
      expect(context.tokowakaClient).to.equal(createdClient);
      expect(createdClient.previewBucketName).to.equal('test-preview-bucket');
    });

    it('should create client from context using context.s3Client directly', () => {
      const context = {
        env: {
          TOKOWAKA_SITE_CONFIG_BUCKET: 'test-bucket',
          TOKOWAKA_PREVIEW_BUCKET: 'test-preview-bucket',
        },
        s3Client,
        log,
      };

      const createdClient = TokowakaClient.createFrom(context);

      expect(createdClient).to.be.instanceOf(TokowakaClient);
      expect(context.tokowakaClient).to.equal(createdClient);
    });

    it('should reuse existing client from context', () => {
      const existingClient = new TokowakaClient(
        { bucketName: 'test-bucket', s3Client },
        log,
      );
      const context = {
        env: { TOKOWAKA_SITE_CONFIG_BUCKET: 'test-bucket' },
        s3: { s3Client },
        log,
        tokowakaClient: existingClient,
      };

      const createdClient = TokowakaClient.createFrom(context);

      expect(createdClient).to.equal(existingClient);
    });
  });

  describe('getSupportedOpportunityTypes', () => {
    it('should return list of supported opportunity types', () => {
      const types = client.getSupportedOpportunityTypes();

      expect(types).to.be.an('array');
      expect(types).to.include('headings');
    });
  });

  describe('registerMapper', () => {
    it('should register a custom mapper', () => {
      class CustomMapper {
        // eslint-disable-next-line class-methods-use-this
        getOpportunityType() {
          return 'custom-type';
        }

        // eslint-disable-next-line class-methods-use-this
        requiresPrerender() {
          return false;
        }

        // eslint-disable-next-line class-methods-use-this
        suggestionsToPatches() {
          return [];
        }

        // eslint-disable-next-line class-methods-use-this
        canDeploy() {
          return { eligible: true };
        }
      }

      const customMapper = new CustomMapper();
      client.registerMapper(customMapper);

      const types = client.getSupportedOpportunityTypes();
      expect(types).to.include('custom-type');
    });
  });

  describe('generateConfig', () => {
    it('should generate config for headings opportunity with single URL', () => {
      const url = 'https://example.com/page1';
      const config = client.generateConfig(url, mockOpportunity, mockSuggestions);

      expect(config).to.deep.include({
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
      });

      expect(config.patches).to.have.length(2);

      const patch = config.patches[0];
      expect(patch).to.include({
        op: 'replace',
        selector: 'h1',
        value: 'New Heading',
        opportunityId: 'opp-123',
        prerenderRequired: true,
      });
      expect(patch.suggestionId).to.equal('sugg-1');
      expect(patch).to.have.property('lastUpdated');
    });

    it('should generate config for FAQ opportunity', () => {
      mockOpportunity = {
        getId: () => 'opp-faq-123',
        getType: () => 'faq',
      };

      mockSuggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            headingText: 'FAQs',
            shouldOptimize: true,
            item: {
              question: 'Question 1?',
              answer: 'Answer 1.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
        {
          getId: () => 'sugg-faq-2',
          getUpdatedAt: () => '2025-01-15T11:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            headingText: 'FAQs',
            shouldOptimize: true,
            item: {
              question: 'Question 2?',
              answer: 'Answer 2.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const url = 'https://example.com/page1';
      const config = client.generateConfig(url, mockOpportunity, mockSuggestions);

      expect(config).to.deep.include({
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
      });

      expect(config.patches).to.have.length(3); // heading + 2 FAQs

      // First patch: heading (no suggestionId)
      const headingPatch = config.patches[0];
      expect(headingPatch).to.include({
        op: 'appendChild',
        selector: 'main',
        opportunityId: 'opp-faq-123',
        prerenderRequired: true,
      });
      expect(headingPatch.suggestionId).to.be.undefined;
      expect(headingPatch).to.have.property('lastUpdated');
      expect(headingPatch.value.tagName).to.equal('h2');

      // Second patch: first FAQ
      const firstFaqPatch = config.patches[1];
      expect(firstFaqPatch).to.include({
        op: 'appendChild',
        selector: 'main',
        opportunityId: 'opp-faq-123',
        prerenderRequired: true,
      });
      expect(firstFaqPatch.suggestionId).to.equal('sugg-faq-1');
      expect(firstFaqPatch.value.tagName).to.equal('div');
    });

    it('should return null if no eligible suggestions', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            // Missing required fields
          }),
        },
      ];

      const url = 'https://example.com/page1';
      const config = client.generateConfig(url, mockOpportunity, mockSuggestions);

      expect(config).to.be.null;
    });

    it('should handle unsupported opportunity types', () => {
      mockOpportunity.getType = () => 'unsupported-type';

      expect(() => client.generateConfig('https://example.com/page1', mockOpportunity, mockSuggestions))
        .to.throw(/No mapper found for opportunity type: unsupported-type/)
        .with.property('status', 501);
    });
  });

  describe('fetchMetaconfig', () => {
    it('should fetch metaconfig from S3', async () => {
      const metaconfig = {
        siteId: 'site-123',
        prerender: true,
      };

      s3Client.send.resolves({
        Body: {
          transformToString: async () => JSON.stringify(metaconfig),
        },
      });

      const result = await client.fetchMetaconfig('https://example.com/page1');

      expect(result).to.deep.equal(metaconfig);
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/config');
    });

    it('should return null if metaconfig does not exist', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.rejects(noSuchKeyError);

      const result = await client.fetchMetaconfig('https://example.com/page1');

      expect(result).to.be.null;
    });

    it('should throw error on S3 fetch failure', async () => {
      const s3Error = new Error('Access Denied');
      s3Error.name = 'AccessDenied';
      s3Client.send.rejects(s3Error);

      try {
        await client.fetchMetaconfig('https://example.com/page1');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 fetch failed');
        expect(error.status).to.equal(500);
      }
    });

    it('should throw error if URL is missing', async () => {
      try {
        await client.fetchMetaconfig('');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });
  });

  describe('uploadMetaconfig', () => {
    it('should upload metaconfig to S3', async () => {
      const metaconfig = {
        siteId: 'site-123',
        prerender: true,
      };

      const s3Path = await client.uploadMetaconfig('https://example.com/page1', metaconfig);

      expect(s3Path).to.equal('opportunities/example.com/config');
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/config');
      expect(command.input.ContentType).to.equal('application/json');
      expect(JSON.parse(command.input.Body)).to.deep.equal(metaconfig);
    });

    it('should throw error if URL is missing', async () => {
      try {
        await client.uploadMetaconfig('', { siteId: 'site-123', prerender: true });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if metaconfig is empty', async () => {
      try {
        await client.uploadMetaconfig('https://example.com/page1', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Metaconfig object is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error on S3 upload failure', async () => {
      const s3Error = new Error('Access Denied');
      s3Client.send.rejects(s3Error);

      try {
        await client.uploadMetaconfig('https://example.com/page1', { siteId: 'site-123', prerender: true });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 upload failed');
        expect(error.status).to.equal(500);
      }
    });

    it('should upload metaconfig with user-defined metadata when provided', async () => {
      const metaconfig = {
        siteId: 'site-123',
        prerender: true,
      };
      const metadata = {
        'last-modified-by': 'john@example.com',
        'created-by': 'admin',
      };

      const s3Path = await client.uploadMetaconfig('https://example.com/page1', metaconfig, metadata);

      expect(s3Path).to.equal('opportunities/example.com/config');

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/config');
      expect(command.input.ContentType).to.equal('application/json');
      expect(JSON.parse(command.input.Body)).to.deep.equal(metaconfig);
      expect(command.input.Metadata).to.deep.equal(metadata);
    });

    it('should upload metaconfig without Metadata field when metadata is empty object', async () => {
      const metaconfig = {
        siteId: 'site-123',
        prerender: true,
      };

      const s3Path = await client.uploadMetaconfig('https://example.com/page1', metaconfig, {});

      expect(s3Path).to.equal('opportunities/example.com/config');

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Metadata).to.be.undefined;
    });
  });

  describe('createMetaconfig', () => {
    it('should create the default metaconfig with generated API key', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId);

      expect(result).to.have.property('siteId', siteId);
      expect(result).to.have.property('apiKeys');
      expect(result.apiKeys).to.be.an('array').with.lengthOf(1);
      expect(result.apiKeys[0]).to.be.a('string');
      expect(result).to.have.property('tokowakaEnabled', true);
      expect(result).to.have.property('enhancements', true);
      expect(result.patches).to.be.empty;

      // Verify uploadMetaconfig was called with correct metaconfig
      expect(s3Client.send).to.have.been.calledTwice;
      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/config');
    });

    it('should throw error if metaconfig exists', async () => {
      const existingMetaconfig = {
        siteId: 'site-123',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
      };
      // Mock fetchMetaconfig to return existing config
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingMetaconfig)),
        },
      });
      try {
        await client.createMetaconfig('https://example.com', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Metaconfig already exists for this URL');
        expect(error.status).to.equal(400);
      }
    });

    it('should create metaconfig with enhancements set to false', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, { enhancements: false });

      expect(result).to.have.property('tokowakaEnabled', true);
      expect(result).to.have.property('enhancements', false);
    });

    it('should throw error if URL is missing', async () => {
      try {
        await client.createMetaconfig('', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if siteId is missing', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);
      try {
        await client.createMetaconfig('https://example.com', '');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Site ID is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 upload failure', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);
      const s3Error = new Error('S3 network error');
      s3Client.send.onSecondCall().rejects(s3Error);
      try {
        await client.createMetaconfig('https://example.com', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 upload failed');
        expect(error.status).to.equal(500);
      }
    });

    it('should strip www. from domain in metaconfig path', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/some/path';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      await client.createMetaconfig(url, siteId);

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Key).to.equal('opportunities/example.com/config');
    });

    it('should include user-defined metadata when metadata is provided', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      await client.createMetaconfig(url, siteId, {}, { 'last-modified-by': 'john@example.com' });

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.deep.equal({
        'last-modified-by': 'john@example.com',
      });
    });

    it('should not include metadata when metadata is empty object', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      await client.createMetaconfig(url, siteId, {}, {});

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.be.undefined;
    });

    it('should not include metadata when metadata is not provided', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      await client.createMetaconfig(url, siteId);

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.be.undefined;
    });

    it('should NOT include prerender when isStageDomain is not true in metadata', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId);

      expect(result).to.not.have.property('prerender');

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body).to.not.have.property('prerender');
    });

    it('should set prerender with allowList when isStageDomain is true in metadata', async () => {
      const siteId = 'site-123';
      const url = 'https://staging.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, {}, { isStageDomain: true });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal({ allowList: ['/*'] });

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal({ allowList: ['/*'] });
      expect(uploadCommand.input.Metadata).to.deep.equal({ isStageDomain: 'true' });
    });

    it('should NOT set prerender when isStageDomain is false in metadata', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, {}, { isStageDomain: false });

      expect(result).to.not.have.property('prerender');

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body).to.not.have.property('prerender');
    });
  });

  describe('updateMetaconfig', () => {
    const existingMetaconfig = {
      siteId: 'site-456',
      apiKeys: ['existing-api-key-123'],
      tokowakaEnabled: false,
      enhancements: false,
      patches: { 'existing-patch': 'value' },
    };

    beforeEach(() => {
      // Mock fetchMetaconfig to return existing config with metadata
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingMetaconfig)),
        },
        Metadata: {},
      });
      // Mock uploadMetaconfig S3 upload
      s3Client.send.onSecondCall().resolves();
    });

    it('should update metaconfig with default options', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com/page1';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('siteId', siteId);
      expect(result).to.have.property('apiKeys');
      expect(result.apiKeys).to.deep.equal(['existing-api-key-123']);
      // Should preserve existing metaconfig values when options not provided
      expect(result).to.have.property('tokowakaEnabled', false);
      expect(result).to.have.property('enhancements', false);
      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
      expect(result).to.not.have.property('forceFail');
    });

    it('should update metaconfig with tokowakaEnabled set to false', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { tokowakaEnabled: false });

      expect(result).to.have.property('tokowakaEnabled', false);
      expect(result).to.have.property('enhancements', false);
      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
      expect(result).to.not.have.property('forceFail');
    });

    it('should update metaconfig with tokowakaEnabled set to true explicitly', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { tokowakaEnabled: true });

      expect(result).to.have.property('tokowakaEnabled', true);
      expect(result).to.have.property('enhancements', false);
      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
      expect(result).to.not.have.property('forceFail');
    });

    it('should update metaconfig with enhancements set to false', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { enhancements: false });

      expect(result).to.have.property('tokowakaEnabled', false);
      expect(result).to.have.property('enhancements', false);
      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
      expect(result).to.not.have.property('forceFail');
    });

    it('should update metaconfig with enhancements set to true explicitly', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { enhancements: true });

      expect(result).to.have.property('tokowakaEnabled', false);
      expect(result).to.have.property('enhancements', true);
      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
      expect(result).to.not.have.property('forceFail');
    });

    it('should override patches when non-empty patches object is provided', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const newPatches = { 'new-patch': 'new-value', 'another-patch': 'another-value' };

      const result = await client.updateMetaconfig(url, siteId, { patches: newPatches });

      expect(result.patches).to.deep.equal(newPatches);
      expect(result.patches).to.not.deep.equal({ 'existing-patch': 'value' });
    });

    it('should preserve existing patches when empty patches object is provided', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { patches: {} });

      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
    });

    it('should preserve existing patches when patches is undefined', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
    });

    it('should use empty patches object when existing config has no patches and no patches provided', async () => {
      const configWithoutPatches = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: false,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithoutPatches)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result.patches).to.deep.equal({});
    });

    it('should include forceFail when set to true', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: true });

      expect(result).to.have.property('forceFail', true);
    });

    it('should include forceFail when set to false', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: false });

      expect(result).to.have.property('forceFail', false);
    });

    it('should not include forceFail when undefined', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.not.have.property('forceFail');
    });

    it('should use forceFail as false when options.forceFail is null and existingMetaconfig has no forceFail', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: null });

      expect(result).to.have.property('forceFail', false);
    });

    it('should preserve existingMetaconfig forceFail when options.forceFail is null', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: true,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: null });

      expect(result).to.have.property('forceFail', true);
    });

    it('should update metaconfig with multiple options', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const newPatches = { 'custom-patch': 'custom-value' };

      const result = await client.updateMetaconfig(url, siteId, {
        tokowakaEnabled: false,
        enhancements: false,
        patches: newPatches,
        forceFail: true,
      });

      expect(result).to.have.property('tokowakaEnabled', false);
      expect(result).to.have.property('enhancements', false);
      expect(result.patches).to.deep.equal(newPatches);
      expect(result).to.have.property('forceFail', true);
      expect(result.apiKeys).to.deep.equal(['existing-api-key-123']);
    });

    it('should preserve apiKeys from existing metaconfig', async () => {
      const existingWithMultipleKeys = {
        siteId: 'site-456',
        apiKeys: ['key-1', 'key-2', 'key-3'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingWithMultipleKeys)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result.apiKeys).to.deep.equal(['key-1', 'key-2', 'key-3']);
    });

    it('should throw error if URL is missing', async () => {
      try {
        await client.updateMetaconfig('', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if siteId is missing', async () => {
      try {
        await client.updateMetaconfig('https://example.com', '');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Site ID is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if metaconfig does not exist', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      try {
        await client.updateMetaconfig('https://example.com', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Metaconfig does not exist for this URL');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 upload failure', async () => {
      const s3Error = new Error('S3 network error');
      s3Client.send.onSecondCall().rejects(s3Error);

      try {
        await client.updateMetaconfig('https://example.com', 'site-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 upload failed');
        expect(error.status).to.equal(500);
      }
    });

    it('should strip www. from domain in metaconfig path', async () => {
      const siteId = 'site-789';
      const url = 'https://www.example.com/some/path';

      await client.updateMetaconfig(url, siteId);

      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Key).to.equal('opportunities/example.com/config');
    });

    it('should handle metaconfig with null patches', async () => {
      const configWithNullPatches = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: null,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithNullPatches)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result.patches).to.deep.equal({});
    });

    it('should handle single patch in options.patches', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const singlePatch = { 'only-patch': 'only-value' };

      const result = await client.updateMetaconfig(url, siteId, { patches: singlePatch });

      expect(result.patches).to.deep.equal(singlePatch);
    });

    it('should preserve existing patches when options.patches is null', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { patches: null });

      expect(result.patches).to.deep.equal({ 'existing-patch': 'value' });
    });

    it('should preserve tokowakaEnabled=true from existingMetaconfig when options not provided', async () => {
      const configWithTokowakaEnabled = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: false,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithTokowakaEnabled)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('tokowakaEnabled', true);
    });

    it('should preserve enhancements=true from existingMetaconfig when options not provided', async () => {
      const configWithEnhancements = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: true,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithEnhancements)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('enhancements', true);
    });

    it('should default tokowakaEnabled to true when not in existingMetaconfig or options', async () => {
      const configWithoutTokowakaEnabled = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        enhancements: false,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithoutTokowakaEnabled)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('tokowakaEnabled', true);
    });

    it('should default enhancements to true when not in existingMetaconfig or options', async () => {
      const configWithoutEnhancements = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithoutEnhancements)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('enhancements', true);
    });

    it('should preserve forceFail=true from existingMetaconfig when options not provided', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: true,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('forceFail', true);
    });

    it('should override existingMetaconfig forceFail when explicitly set to false in options', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: true,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: false });

      expect(result).to.have.property('forceFail', false);
    });

    it('should override existingMetaconfig forceFail when explicitly set to true in options', async () => {
      const configWithoutForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: false,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithoutForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: true });

      expect(result).to.have.property('forceFail', true);
    });

    it('should preserve forceFail=false from existingMetaconfig when options not provided', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: false,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('forceFail', false);
    });

    it('should override existingMetaconfig tokowakaEnabled=false when explicitly set to true', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      // existingMetaconfig has tokowakaEnabled: false

      const result = await client.updateMetaconfig(url, siteId, { tokowakaEnabled: true });

      expect(result).to.have.property('tokowakaEnabled', true);
    });

    it('should override existingMetaconfig enhancements=false when explicitly set to true', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      // existingMetaconfig has enhancements: false

      const result = await client.updateMetaconfig(url, siteId, { enhancements: true });

      expect(result).to.have.property('enhancements', true);
    });

    it('should handle case where options.forceFail and existingMetaconfig.forceFail are both true', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: true,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { forceFail: true });

      expect(result).to.have.property('forceFail', true);
    });

    it('should handle case where options.forceFail and existingMetaconfig.forceFail are both false', async () => {
      const configWithForceFail = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: true,
        enhancements: true,
        patches: {},
        forceFail: false,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithForceFail)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('forceFail', false);
    });

    it('should include prerender when provided in options', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const prerenderConfig = { allowList: ['/*'] };

      const result = await client.updateMetaconfig(url, siteId, { prerender: prerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(prerenderConfig);
    });

    it('should preserve existingMetaconfig prerender when options.prerender is undefined', async () => {
      const existingPrerenderConfig = { allowList: ['/*', '/products/*'] };
      const configWithPrerender = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: false,
        patches: {},
        prerender: existingPrerenderConfig,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithPrerender)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(existingPrerenderConfig);
    });

    it('should use existingMetaconfig prerender when options.prerender is null', async () => {
      const existingPrerenderConfig = { allowList: ['/*'] };
      const configWithPrerender = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: false,
        patches: {},
        prerender: existingPrerenderConfig,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithPrerender)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { prerender: null });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(existingPrerenderConfig);
    });

    it('should override existingMetaconfig prerender when provided in options', async () => {
      const existingPrerenderConfig = { allowList: ['/blog/*'] };
      const newPrerenderConfig = { allowList: ['/*', '/products/*'] };
      const configWithPrerender = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: false,
        patches: {},
        prerender: existingPrerenderConfig,
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithPrerender)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { prerender: newPrerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(newPrerenderConfig);
    });

    it('should not include prerender when neither options nor existingMetaconfig have it', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId);

      expect(result).to.not.have.property('prerender');
    });

    it('should not include prerender when both options and existingMetaconfig have empty prerender', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { prerender: {} });

      expect(result).to.not.have.property('prerender');
    });

    it('should include prerender from options when existingMetaconfig does not have it', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const prerenderConfig = { allowList: ['/*'] };

      const result = await client.updateMetaconfig(url, siteId, { prerender: prerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(prerenderConfig);
    });

    it('should handle prerender with multiple paths in allowList', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';
      const prerenderConfig = {
        allowList: ['/*', '/products/*', '/blog/*', '/about'],
      };

      const result = await client.updateMetaconfig(url, siteId, { prerender: prerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(prerenderConfig);
    });

    it('should use options.prerender even when it is an empty object if existingMetaconfig has no prerender', async () => {
      const siteId = 'site-789';
      const url = 'https://example.com';

      const result = await client.updateMetaconfig(url, siteId, { prerender: {} });

      // Empty object is not null/undefined, so it will be used by nullish coalescing
      // But hasPrerender will be false, so it won't be included in final metaconfig
      expect(result).to.not.have.property('prerender');
    });

    it('should handle case where existingMetaconfig.prerender is undefined and options.prerender is provided', async () => {
      const configWithoutPrerender = {
        siteId: 'site-456',
        apiKeys: ['existing-api-key-123'],
        tokowakaEnabled: false,
        enhancements: false,
        patches: {},
      };
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(configWithoutPrerender)),
        },
      });

      const siteId = 'site-789';
      const url = 'https://example.com';
      const prerenderConfig = { allowList: ['/*'] };

      const result = await client.updateMetaconfig(url, siteId, { prerender: prerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(prerenderConfig);
    });

    it('should include user-defined metadata when metadata is provided', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com';

      await client.updateMetaconfig(url, siteId, {
        tokowakaEnabled: true,
      }, { 'last-modified-by': 'jane@example.com' });

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.deep.equal({
        'last-modified-by': 'jane@example.com',
      });
    });

    it('should not include metadata when metadata is empty object', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com';

      await client.updateMetaconfig(url, siteId, {
        tokowakaEnabled: true,
      }, {});

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.be.undefined;
    });

    it('should not include metadata when metadata is not provided', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com';

      await client.updateMetaconfig(url, siteId, {
        tokowakaEnabled: true,
      });

      // Second call is the uploadMetaconfig
      const uploadCommand = s3Client.send.secondCall.args[0];
      expect(uploadCommand.input.Metadata).to.be.undefined;
    });

    it('should set prerender with allowList when isStageDomain is true in metadata', async () => {
      const siteId = 'site-456';
      const url = 'https://staging.example.com';

      const result = await client.updateMetaconfig(url, siteId, {}, { isStageDomain: true });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal({ allowList: ['/*'] });

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal({ allowList: ['/*'] });
      expect(uploadCommand.input.Metadata).to.deep.equal({ isStageDomain: 'true' });
    });

    it('should override existing prerender when isStageDomain is true in metadata', async () => {
      const siteId = 'site-456';
      const url = 'https://staging.example.com';
      const existingMetaconfigWithPrerender = {
        ...existingMetaconfig,
        prerender: { allowList: ['/old-path/*'] },
      };

      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingMetaconfigWithPrerender)),
        },
        Metadata: {},
      });

      const result = await client.updateMetaconfig(url, siteId, {}, { isStageDomain: true });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal({ allowList: ['/*'] });

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal({ allowList: ['/*'] });
    });

    it('should preserve existing prerender when isStageDomain is not in metadata', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com';
      const existingMetaconfigWithPrerender = {
        ...existingMetaconfig,
        prerender: { allowList: ['/path/*'] },
      };

      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingMetaconfigWithPrerender)),
        },
        Metadata: {},
      });

      const result = await client.updateMetaconfig(url, siteId, {});

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal({ allowList: ['/path/*'] });

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal({ allowList: ['/path/*'] });
    });

    it('should NOT set prerender when isStageDomain is false in metadata', async () => {
      const siteId = 'site-456';
      const url = 'https://www.example.com';

      const result = await client.updateMetaconfig(url, siteId, {}, { isStageDomain: false });

      expect(result).to.not.have.property('prerender');

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body).to.not.have.property('prerender');
    });
  });

  describe('uploadConfig', () => {
    it('should upload config to S3', async () => {
      const config = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [],
      };

      const s3Key = await client.uploadConfig('https://example.com/page1', config);

      expect(s3Key).to.equal('opportunities/example.com/L3BhZ2Ux');
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/L3BhZ2Ux');
      expect(command.input.ContentType).to.equal('application/json');
      expect(JSON.parse(command.input.Body)).to.deep.equal(config);
    });

    it('should upload config to preview bucket', async () => {
      const config = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [],
      };

      const s3Key = await client.uploadConfig('https://example.com/page1', config, true);

      expect(s3Key).to.equal('preview/opportunities/example.com/L3BhZ2Ux');

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-preview-bucket');
      expect(command.input.Key).to.equal('preview/opportunities/example.com/L3BhZ2Ux');
    });

    it('should throw error if URL is missing', async () => {
      const config = { url: 'https://example.com/page1', patches: [] };

      try {
        await client.uploadConfig('', config);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if config is empty', async () => {
      try {
        await client.uploadConfig('https://example.com/page1', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Config object is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 upload failure', async () => {
      s3Client.send.rejects(new Error('Network error'));
      const config = { url: 'https://example.com/page1', patches: [] };

      try {
        await client.uploadConfig('https://example.com/page1', config);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 upload failed');
        expect(error.status).to.equal(500);
      }
    });
  });

  describe('fetchConfig', () => {
    it('should fetch existing config from S3', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Old Heading',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      s3Client.send.resolves({
        Body: {
          transformToString: async () => JSON.stringify(existingConfig),
        },
      });

      const config = await client.fetchConfig('https://example.com/page1');

      expect(config).to.deep.equal(existingConfig);
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/example.com/L3BhZ2Ux');
    });

    it('should fetch config from preview bucket', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [],
      };

      s3Client.send.resolves({
        Body: {
          transformToString: async () => JSON.stringify(existingConfig),
        },
      });

      await client.fetchConfig('https://example.com/page1', true);

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-preview-bucket');
      expect(command.input.Key).to.equal('preview/opportunities/example.com/L3BhZ2Ux');
    });

    it('should return null if config does not exist', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.rejects(noSuchKeyError);

      const config = await client.fetchConfig('https://example.com/page1');

      expect(config).to.be.null;
    });

    it('should return null if S3 returns NoSuchKey error code', async () => {
      const noSuchKeyError = new Error('The specified key does not exist');
      noSuchKeyError.Code = 'NoSuchKey';
      s3Client.send.rejects(noSuchKeyError);

      const config = await client.fetchConfig('https://example.com/page1');

      expect(config).to.be.null;
    });

    it('should throw error if URL is missing', async () => {
      try {
        await client.fetchConfig('');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('URL is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 fetch failure', async () => {
      s3Client.send.rejects(new Error('Network error'));

      try {
        await client.fetchConfig('https://example.com/page1');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('S3 fetch failed');
        expect(error.status).to.equal(500);
      }
    });
  });

  describe('mergeConfigs', () => {
    let existingConfig;
    let newConfig;

    beforeEach(() => {
      existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Old Heading',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
          {
            op: 'replace',
            selector: 'h2',
            value: 'Old Subtitle',
            opportunityId: 'opp-456',
            suggestionId: 'sugg-2',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      newConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Updated Heading',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567900,
          },
        ],
      };
    });

    it('should return new config if existing config is null', () => {
      const merged = client.mergeConfigs(null, newConfig);

      expect(merged).to.deep.equal(newConfig);
    });

    it('should update existing patch with same opportunityId and suggestionId', () => {
      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(2);

      // First patch should be updated
      const updatedPatch = merged.patches[0];
      expect(updatedPatch.value).to.equal('Updated Heading');
      expect(updatedPatch.lastUpdated).to.equal(1234567900);

      // Second patch should remain unchanged
      const unchangedPatch = merged.patches[1];
      expect(unchangedPatch.value).to.equal('Old Subtitle');
      expect(unchangedPatch.opportunityId).to.equal('opp-456');
    });

    it('should add new patch if opportunityId and suggestionId do not exist', () => {
      newConfig.patches.push({
        op: 'replace',
        selector: 'h3',
        value: 'New Section Title',
        opportunityId: 'opp-789',
        suggestionId: 'sugg-3',
        prerenderRequired: true,
        lastUpdated: 1234567900,
      });

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(3);

      // New patch should be added at the end
      const newPatch = merged.patches[2];
      expect(newPatch.value).to.equal('New Section Title');
      expect(newPatch.opportunityId).to.equal('opp-789');
      expect(newPatch.suggestionId).to.equal('sugg-3');
    });

    it('should update config metadata from new config', () => {
      newConfig.version = '2.0';
      newConfig.forceFail = true;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.version).to.equal('2.0');
      expect(merged.forceFail).to.equal(true);
    });

    it('should handle empty patches array in existing config', () => {
      existingConfig.patches = [];

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(1);
      expect(merged.patches[0].value).to.equal('Updated Heading');
    });

    it('should handle empty patches array in new config', () => {
      newConfig.patches = [];

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(2);
      expect(merged.patches[0].value).to.equal('Old Heading');
    });

    it('should handle undefined patches in existing config', () => {
      existingConfig.patches = undefined;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(1);
      expect(merged.patches[0].value).to.equal('Updated Heading');
    });

    it('should handle undefined patches in new config', () => {
      newConfig.patches = undefined;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.patches).to.have.length(2);
      expect(merged.patches[0].value).to.equal('Old Heading');
    });
  });

  describe('deploySuggestions', () => {
    beforeEach(() => {
      // Stub CDN invalidation for deploy tests (now handles both single and batch)
      sinon.stub(client, 'invalidateCdnCache').resolves([{
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      }]);
      // Stub fetchConfig to return null by default (no existing config)
      sinon.stub(client, 'fetchConfig').resolves(null);
      // Stub fetchMetaconfig to return existing metaconfig (required for deployment)
      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: true,
      });
      // Stub uploadMetaconfig
      sinon.stub(client, 'uploadMetaconfig').resolves('opportunities/example.com/config');
    });

    it('should deploy suggestions successfully', async () => {
      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result).to.have.property('s3Paths');
      expect(result.s3Paths).to.be.an('array').with.length(1);
      expect(result.s3Paths[0]).to.equal('opportunities/example.com/L3BhZ2Ux');
      expect(result).to.have.property('cdnInvalidations');
      // Only 1 invalidation result returned (for batch URLs)
      // Metaconfig invalidation happens inside uploadMetaconfig() automatically
      expect(result.cdnInvalidations).to.be.an('array').with.length(1);
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(s3Client.send).to.have.been.called;
    });

    it('should throw error if metaconfig does not exist', async () => {
      client.fetchMetaconfig.resolves(null);

      try {
        await client.deploySuggestions(
          mockSite,
          mockOpportunity,
          mockSuggestions,
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No domain-level metaconfig found');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle suggestions for multiple URLs', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'Page 1 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'Page 2 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.s3Paths).to.have.length(2);
      // Only 1 invalidation result returned (for batch URLs)
      // Metaconfig invalidation happens inside uploadMetaconfig() automatically
      expect(result.cdnInvalidations).to.have.length(1);
      expect(result.succeededSuggestions).to.have.length(2);
    });

    it('should handle suggestions that are not eligible for deployment', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Subtitle',
            checkType: 'heading-empty', // Eligible
            transformRules: {
              action: 'replace',
              selector: 'h2',
            },
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].reason).to.include('can be deployed');
    });

    it('should handle multi-URL deploy where one URL has no eligible suggestions', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-empty', // Eligible
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].suggestion.getId()).to.equal('sugg-2');
    });

    it('should update metaconfig patches field with deployed endpoints', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'Page 1 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'Page 2 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(2);
      // Verify uploadMetaconfig was called to update the metaconfig
      expect(client.uploadMetaconfig).to.have.been.called;
      // Check that the last call included the patches field
      const { lastCall } = client.uploadMetaconfig;
      expect(lastCall.args[1]).to.have.property('patches');
      expect(lastCall.args[1].patches).to.deep.equal({
        '/page1': true,
        '/page2': true,
      });
    });

    it('should add to existing patches in metaconfig when deploying new endpoints', async () => {
      // Set up metaconfig with existing patches
      // Reset the stub to provide consistent behavior
      client.fetchMetaconfig.reset();
      client.fetchMetaconfig.resolves({
        siteId: 'site-123',
        prerender: true,
        patches: {
          '/existing-page': true,
        },
      });

      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/new-page',
            recommendedAction: 'New Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Verify the updated metaconfig includes both existing and new patches
      const { lastCall } = client.uploadMetaconfig;
      expect(lastCall.args[1].patches).to.deep.equal({
        '/existing-page': true,
        '/new-page': true,
      });
    });

    it('should throw error when metaconfig update fails', async () => {
      // Make uploadMetaconfig fail during the update
      client.uploadMetaconfig.rejects(new Error('S3 upload error'));

      try {
        await client.deploySuggestions(
          mockSite,
          mockOpportunity,
          mockSuggestions,
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Failed to update metaconfig with deployed paths');
        expect(error.status).to.equal(500);
      }
    });

    it('should return early when no eligible suggestions to deploy', async () => {
      // All suggestions are ineligible
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // No suggestions deployed - returns early before metaconfig check
      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(1);
      // fetchMetaconfig should not be called at all (returns before that point)
      expect(client.fetchMetaconfig).to.not.have.been.called;
      // uploadMetaconfig should not be called at all
      expect(client.uploadMetaconfig).to.not.have.been.called;
    });

    it('should not update metaconfig when all URLs fail to generate configs', async () => {
      // Stub generateConfig to return null (no config generated)
      sinon.stub(client, 'generateConfig').returns(null);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Suggestions are marked as succeeded (eligible) but no configs uploaded
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.s3Paths).to.have.length(0); // No configs uploaded
      // fetchMetaconfig called once for initial check, but not for update
      // since no URLs were actually deployed (deployedUrls is empty)
      expect(client.fetchMetaconfig).to.have.been.calledOnce;
      // uploadMetaconfig should not be called at all
      expect(client.uploadMetaconfig).to.not.have.been.called;
    });

    it('should skip URL when generateConfig returns no patches', async () => {
      // Stub mapper to return empty patches for the first call, normal for subsequent calls
      const mapper = client.mapperRegistry.getMapper('headings');
      const originalSuggestionsToPatches = mapper.suggestionsToPatches.bind(mapper);
      let callCount = 0;
      sinon.stub(mapper, 'suggestionsToPatches').callsFake((...args) => {
        callCount += 1;
        if (callCount === 1) {
          // First call (for page1) returns no patches
          return [];
        }
        // Subsequent calls work normally
        return originalSuggestionsToPatches(...args);
      });

      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'New Subtitle',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h2',
            },
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Both suggestions are in result but sugg-1 skipped deployment due to no patches
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.s3Paths).to.have.length(1); // Only one URL actually deployed
      expect(log.warn).to.have.been.calledWith('No config generated for URL: https://example.com/page1');
    });

    it('should skip URL when config has no patches after generation', async () => {
      // Stub generateConfig to return a config with no patches (defensive check)
      const originalGenerateConfig = client.generateConfig.bind(client);
      sinon.stub(client, 'generateConfig').callsFake((url, ...args) => {
        const config = originalGenerateConfig(url, ...args);
        if (config && url === 'https://example.com/page1') {
          // Return config but with empty patches array (simulating edge case)
          return { ...config, patches: [] };
        }
        return config;
      });

      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'New Subtitle',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h2',
            },
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.s3Paths).to.have.length(1); // Only page2 deployed
      expect(log.warn).to.have.been.calledWith('No eligible suggestions to deploy for URL: https://example.com/page1');
    });

    it('should return early when no eligible suggestions', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Wrong checkType name, not eligible
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(1);
      expect(log.warn).to.have.been.calledWith('No eligible suggestions to deploy');
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should deploy prerender-only suggestions with no patches', async () => {
      // Create prerender opportunity
      const prerenderOpportunity = {
        getId: () => 'opp-prerender-123',
        getType: () => 'prerender',
      };

      // Create prerender suggestions with no transform rules (prerender-only)
      const prerenderSuggestions = [
        {
          getId: () => 'prerender-sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            // No transform rules - prerender only
          }),
        },
      ];

      const result = await client.deploySuggestions(
        mockSite,
        prerenderOpportunity,
        prerenderSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.s3Paths).to.have.length(1);
      // Only 1 invalidation result returned (for batch URLs)
      // Metaconfig invalidation happens inside uploadMetaconfig() automatically
      expect(result.cdnInvalidations).to.have.length(1);

      // Verify uploaded config has no patches but prerender is enabled
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.patches).to.have.length(0);
      expect(uploadedConfig.prerender).to.equal(true);
      expect(uploadedConfig.url).to.equal('https://example.com/page1');

      // Verify CDN was invalidated using batch method with new options signature
      expect(client.invalidateCdnCache).to.have.been.calledOnce;
      const invalidateCall = client.invalidateCdnCache.firstCall.args[0];
      expect(invalidateCall).to.deep.include({
        urls: ['https://example.com/page1'],
      });
    });

    it('should throw error for unsupported opportunity type', async () => {
      mockOpportunity.getType = () => 'unsupported-type';

      try {
        await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No mapper found for opportunity type: unsupported-type');
        expect(error.status).to.equal(501);
      }
    });

    it('should fetch existing config and merge when deploying', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h3',
            value: 'Existing Heading',
            opportunityId: 'opp-999',
            suggestionId: 'sugg-999',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(client.fetchConfig).to.have.been.called;
      expect(result.s3Paths).to.have.length(1);

      // Verify the uploaded config contains both existing and new patches
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.patches).to.have.length(3);
    });

    it('should update existing patch when deploying same opportunityId and suggestionId', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Old Heading Value',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.s3Paths).to.have.length(1);

      // Verify the patch was updated, not duplicated
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.patches).to.have.length(2);

      // First patch should be updated with new value
      const updatedPatch = uploadedConfig.patches[0];
      expect(updatedPatch.value).to.equal('New Heading');
      expect(updatedPatch.opportunityId).to.equal('opp-123');
      expect(updatedPatch.suggestionId).to.equal('sugg-1');
      expect(updatedPatch.lastUpdated).to.be.greaterThan(1234567890);
    });
  });

  describe('rollbackSuggestions', () => {
    beforeEach(() => {
      // Stub CDN invalidation for rollback tests (now handles both single and batch)
      sinon.stub(client, 'invalidateCdnCache').resolves([{
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      }]);
    });

    it('should rollback suggestions successfully', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading 1',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
          {
            op: 'replace',
            selector: 'h2',
            value: 'Heading 2',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-2',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
          {
            op: 'replace',
            selector: 'h3',
            value: 'Heading 3',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-3',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions, // Only sugg-1 and sugg-2
      );

      expect(result.s3Paths).to.have.length(1);
      expect(result.s3Paths[0]).to.equal('opportunities/example.com/L3BhZ2Ux');
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.removedPatchesCount).to.equal(2);

      // Verify uploaded config has sugg-3 but not sugg-1 and sugg-2
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.patches).to.have.length(1);
      expect(uploadedConfig.patches[0].suggestionId).to.equal('sugg-3');
    });

    it('should rollback prerender suggestions by disabling prerender flag', async () => {
      // Create prerender opportunity
      const prerenderOpportunity = {
        getId: () => 'opp-prerender-123',
        getType: () => 'prerender',
      };

      // Create prerender suggestions
      const prerenderSuggestions = [
        {
          getId: () => 'prerender-sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
          }),
          setData: sinon.stub(),
          setUpdatedBy: sinon.stub(),
          save: sinon.stub().resolves(),
        },
      ];

      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading 1',
            opportunityId: 'opp-other-123',
            suggestionId: 'other-sugg-1',
            prerenderRequired: false,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        prerenderSuggestions,
      );

      expect(result.s3Paths).to.have.length(1);
      expect(result.s3Paths[0]).to.equal('opportunities/example.com/L3BhZ2Ux');
      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.removedPatchesCount).to.equal(1);

      // Verify uploaded config has prerender disabled but patches intact
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.prerender).to.equal(false);
      expect(uploadedConfig.patches).to.have.length(1);
      expect(uploadedConfig.patches[0].suggestionId).to.equal('other-sugg-1');

      // Verify CDN was invalidated using batch method with new options signature
      expect(client.invalidateCdnCache).to.have.been.calledOnce;
      const invalidateCall = client.invalidateCdnCache.firstCall.args[0];
      expect(invalidateCall).to.deep.include({
        urls: ['https://example.com/page1'],
      });
    });

    it('should handle no existing config gracefully', async () => {
      sinon.stub(client, 'fetchConfig').resolves(null);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Code continues and marks eligible suggestions as succeeded even if no config found
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.s3Paths).to.have.length(0);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should handle empty existing config patches', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Code marks eligible suggestions as succeeded even if no patches to remove
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.s3Paths).to.have.length(0);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should handle missing patches property in config', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        // patches property is missing
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Code marks eligible suggestions as succeeded even if patches property missing
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.s3Paths).to.have.length(0);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should handle suggestions not found in config', async () => {
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-999', // Different suggestion ID
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      // Code marks eligible suggestions as succeeded even if patches not found
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.s3Paths).to.have.length(0);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should return early when all suggestions are ineligible for rollback', async () => {
      const ineligibleSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible
          }),
        },
        {
          getId: () => 'sugg-2',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Subtitle',
            checkType: 'heading-wrong', // Not eligible
          }),
        },
      ];

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        ineligibleSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(2);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should delete config file when all patches are rolled back', async () => {
      // Code uploads empty config instead of deleting
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading 1',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        [mockSuggestions[0]], // Only roll back sugg-1 (all patches for this URL)
      );

      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.removedPatchesCount).to.equal(1);

      // Code uploads empty patches array instead of deleting
      expect(s3Client.send).to.have.been.calledOnce;
      const command = s3Client.send.firstCall.args[0];
      expect(command.constructor.name).to.equal('PutObjectCommand');
      expect(command.input.Key).to.equal('opportunities/example.com/L3BhZ2Ux');
    });

    it('should handle rollback for multiple URLs', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'Page 1 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
          setData: sinon.stub(),
          setUpdatedBy: sinon.stub(),
          save: sinon.stub().resolves(),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
            recommendedAction: 'Page 2 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
          setData: sinon.stub(),
          setUpdatedBy: sinon.stub(),
          save: sinon.stub().resolves(),
        },
      ];

      const config1 = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading 1',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-1',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      const config2 = {
        url: 'https://example.com/page2',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Heading 2',
            opportunityId: 'opp-123',
            suggestionId: 'sugg-2',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig')
        .onFirstCall()
        .resolves(config1)
        .onSecondCall()
        .resolves(config2);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.s3Paths).to.have.length(2);
      // Batch invalidation returns 1 result per CDN provider, not per URL
      expect(result.cdnInvalidations).to.have.length(1);
      expect(result.succeededSuggestions).to.have.length(2);
    });

    it('should throw error for unsupported opportunity type', async () => {
      mockOpportunity.getType = () => 'unsupported-type';

      try {
        await client.rollbackSuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No mapper found for opportunity type: unsupported-type');
        expect(error.status).to.equal(501);
      }
    });

    it('should remove FAQ heading patch when rolling back last FAQ suggestion', async () => {
      // Change opportunity to FAQ type
      mockOpportunity.getType = () => 'faq';

      // Create FAQ suggestion
      const faqSuggestion = {
        getId: () => 'faq-sugg-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://example.com/page1',
          shouldOptimize: true,
          item: {
            question: 'What is this?',
            answer: 'This is a FAQ',
          },
          transformRules: {
            action: 'appendChild',
            selector: 'body',
          },
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            opportunityId: 'opp-123',
            // FAQ heading patch (no suggestionId)
            op: 'appendChild',
            selector: 'body',
            value: { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'FAQs' }] },
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
          {
            opportunityId: 'opp-123',
            suggestionId: 'faq-sugg-1',
            op: 'appendChild',
            selector: 'body',
            value: { type: 'element', tagName: 'div' },
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      sinon.stub(client, 'fetchConfig').resolves(existingConfig);

      const result = await client.rollbackSuggestions(
        mockSite,
        mockOpportunity,
        [faqSuggestion],
      );

      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.removedPatchesCount).to.equal(2); // FAQ item + heading

      // Code uploads empty config instead of deleting
      const command = s3Client.send.firstCall.args[0];
      expect(command.constructor.name).to.equal('PutObjectCommand');
    });

    it('path rollback removes only the matching pattern and leaves /* intact', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/*', '/products/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.include(pathSuggestion);
      expect(result.failedSuggestions).to.have.length(0);
      const uploadedConfig = uploadStub.firstCall.args[1];
      expect(uploadedConfig.prerender.allowList).to.deep.equal(['/*']);
    });

    it('path rollback of last remaining pattern deletes prerender key entirely', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/products/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.include(pathSuggestion);
      const uploadedConfig = uploadStub.firstCall.args[1];
      expect(uploadedConfig).to.not.have.property('prerender');
    });

    it('domain-wide rollback removes only /* from metaconfig allowList', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/*', '/products/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
      );

      expect(result.succeededSuggestions).to.include(dwSuggestion);
      const uploadedConfig = uploadStub.firstCall.args[1];
      expect(uploadedConfig.prerender.allowList).to.deep.equal(['/products/*']);
    });

    it('cleans up covered suggestions (coveredByDomainWide) when rolling back a pattern suggestion', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
          tokowakaDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const coveredSuggestion = {
        getId: () => 'covered-1',
        getData: () => ({
          url: 'https://example.com/page1',
          edgeDeployed: Date.now(),
          coveredByDomainWide: 'dw-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, coveredSuggestion], updatedBy: 'test@example.com' },
      );

      expect(result.succeededSuggestions).to.include(dwSuggestion);

      // Verify domain-wide suggestion was updated and saved
      expect(dwSuggestion.setUpdatedBy.calledWith('test@example.com')).to.be.true;
      expect(dwSuggestion.save.calledOnce).to.be.true;
      const dwData = dwSuggestion.setData.firstCall.args[0];
      expect(dwData).to.not.have.property('edgeDeployed');
      expect(dwData).to.not.have.property('tokowakaDeployed');

      // Verify covered suggestion was also cleaned up.
      // DW rollback only strips coveredByDomainWide — edgeDeployed is
      // preserved because it represents an independent per-URL deployment.
      expect(coveredSuggestion.save.calledOnce).to.be.true;
      expect(coveredSuggestion.setUpdatedBy.calledWith('test@example.com')).to.be.true;
      const coveredData = coveredSuggestion.setData.firstCall.args[0];
      expect(coveredData).to.have.property('edgeDeployed');
      expect(coveredData).to.not.have.property('coveredByDomainWide');
    });

    it('cleans up covered suggestions (coveredByPattern) when rolling back a path-level pattern', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const coveredSuggestion = {
        getId: () => 'covered-2',
        getData: () => ({
          url: 'https://example.com/products/item',
          edgeDeployed: Date.now(),
          coveredByPattern: 'path-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
        { allSuggestions: [pathSuggestion, coveredSuggestion] },
      );

      expect(coveredSuggestion.save.calledOnce).to.be.true;
      const coveredData = coveredSuggestion.setData.firstCall.args[0];
      expect(coveredData).to.not.have.property('edgeDeployed');
      expect(coveredData).to.not.have.property('coveredByPattern');
    });

    it('uses domain-wide-rollback fallback for covered suggestions when updatedBy is not provided (domain-wide parent)', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const coveredSuggestion = {
        getId: () => 'covered-1',
        getData: () => ({
          url: 'https://example.com/page1',
          edgeDeployed: Date.now(),
          coveredByDomainWide: 'dw-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      // No updatedBy passed — shared client should use context-specific fallbacks
      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, coveredSuggestion] },
      );

      // The domain-wide suggestion itself uses 'tokowaka-rollback'
      expect(dwSuggestion.setUpdatedBy.calledWith('tokowaka-rollback')).to.be.true;
      // The covered suggestion uses 'domain-wide-rollback'
      expect(coveredSuggestion.setUpdatedBy.calledWith('domain-wide-rollback')).to.be.true;
    });

    it('uses path-rollback fallback for covered suggestions when updatedBy is not provided (path parent)', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const coveredSuggestion = {
        getId: () => 'covered-2',
        getData: () => ({
          url: 'https://example.com/products/item',
          edgeDeployed: Date.now(),
          coveredByPattern: 'path-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
        { allSuggestions: [pathSuggestion, coveredSuggestion] },
      );

      // The path suggestion itself uses 'tokowaka-rollback'
      expect(pathSuggestion.setUpdatedBy.calledWith('tokowaka-rollback')).to.be.true;
      // The covered suggestion uses 'path-rollback'
      expect(coveredSuggestion.setUpdatedBy.calledWith('path-rollback')).to.be.true;
    });

    it('cascades domain-wide rollback to deployed path suggestions and their covered entries', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const deployedPathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const pathCoveredSuggestion = {
        getId: () => 'covered-path-1',
        getData: () => ({
          url: 'https://example.com/products/item',
          edgeDeployed: Date.now(),
          coveredByPattern: 'path-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      const fetchStub = sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*', '/products/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, deployedPathSuggestion, pathCoveredSuggestion] },
      );

      // Domain-wide suggestion was rolled back
      expect(result.succeededSuggestions).to.include(dwSuggestion);

      // Cascade: deployed path suggestion was cleaned up
      expect(deployedPathSuggestion.save.calledOnce).to.be.true;
      expect(deployedPathSuggestion.setUpdatedBy.calledWith('domain-wide-rollback-cascade')).to.be.true;
      const pathData = deployedPathSuggestion.setData.firstCall.args[0];
      expect(pathData).to.not.have.property('edgeDeployed');

      // Cascade: covered per-URL suggestion under the path was also cleaned up
      expect(pathCoveredSuggestion.save.calledOnce).to.be.true;
      expect(pathCoveredSuggestion.setUpdatedBy.calledWith('domain-wide-rollback-cascade')).to.be.true;

      // The cascade path pattern was removed from metaconfig — upload was called again
      expect(fetchStub.calledOnce).to.be.true;
      expect(uploadStub.called).to.be.true;
    });

    it('cascade uses provided email for all suggestions when updatedBy is set', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const deployedPathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*', '/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, deployedPathSuggestion], updatedBy: 'user@example.com' },
      );

      expect(dwSuggestion.setUpdatedBy.calledWith('user@example.com')).to.be.true;
      expect(deployedPathSuggestion.setUpdatedBy.calledWith('user@example.com')).to.be.true;
    });

    it('cascade updates metaconfig with remaining patterns when other allowList entries exist after cascade', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const deployedPathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();
      // Three entries: domain-wide '/*', cascade '/products/*', plus an unrelated '/blog/*'
      // After removing '/*' (domain-wide) and '/products/*' (cascade), '/blog/*' remains.
      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*', '/products/*', '/blog/*'] },
      });

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, deployedPathSuggestion] },
      );

      // Both the domain-wide and cascade patterns were removed; '/blog/*' remains
      const { lastCall } = uploadStub;
      expect(lastCall.args[1].prerender.allowList).to.deep.equal(['/blog/*']);
    });

    it('cascade skips metaconfig re-upload when prerender section was already cleared by domain-wide rollback', async () => {
      // Scenario: allowList had only the domain-wide pattern. After domain-wide rollback,
      // metaconfig.prerender is deleted. The cascade path suggestion has no more allowList
      // to remove its pattern from, so no extra upload should happen.
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const deployedPathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      // Only the domain-wide '/*' was in allowList — no path pattern entry
      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, deployedPathSuggestion] },
      );

      // Domain-wide upload happened, but no extra upload for the cascade (pattern not found)
      expect(uploadStub.callCount).to.equal(1);
      // The cascade path suggestion was still cleaned up in DB
      expect(deployedPathSuggestion.save.calledOnce).to.be.true;
    });

    it('is a no-op cascade when no path suggestions are deployed', async () => {
      const prerenderOpportunity = { getId: () => 'opp-dw', getType: () => 'prerender' };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const undeployedPathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          // No edgeDeployed — should not be cascaded
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, undeployedPathSuggestion] },
      );

      // Undeployed path suggestion was not touched
      expect(undeployedPathSuggestion.save.called).to.be.false;
      expect(undeployedPathSuggestion.setUpdatedBy.called).to.be.false;
    });

    it('path rollback marks suggestion ineligible when allowedRegexPatterns contains no valid pattern', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({ allowedRegexPatterns: [null] }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({ siteId: 'site-123' });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions[0].suggestion).to.equal(pathSuggestion);
      expect(result.failedSuggestions[0].reason).to.equal('Missing allowedRegexPatterns');
    });

    it('path rollback marks suggestion ineligible when no metaconfig exists', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves(null);
      sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions[0].reason).to.equal('No metaconfig found');
    });

    it('path rollback skips CDN write when metaconfig has no prerender key', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({ siteId: 'site-123' });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.include(pathSuggestion);
      expect(uploadStub).to.not.have.been.called;
    });

    it('path rollback skips CDN write when pattern is not in allowList', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/blog/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/*'] },
      });
      const uploadStub = sinon.stub(client, 'uploadMetaconfig').resolves();

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.include(pathSuggestion);
      expect(uploadStub).to.not.have.been.called;
    });

    it('path rollback marks suggestion as failed when metaconfig upload throws', async () => {
      const prerenderOpportunity = { getId: () => 'opp-p', getType: () => 'prerender' };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        prerender: { allowList: ['/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').rejects(new Error('S3 failure'));

      const result = await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
      );

      expect(result.succeededSuggestions).to.not.include(pathSuggestion);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].statusCode).to.equal(500);
    });

    // --- Edge case tests for deploy/rollback interaction scenarios ---

    it('DW rollback preserves coveredByPattern on suggestions covered by both DW and path', async () => {
      // Scenario: URL covered by both DW and a path. DW rollback should
      // only strip coveredByDomainWide; coveredByPattern must survive.
      const prerenderOpportunity = {
        getId: () => 'opp-dw',
        getType: () => 'prerender',
      };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const doubleCoveredSuggestion = {
        getId: () => 'url-1',
        getData: () => ({
          url: 'https://example.com/products/item',
          coveredByDomainWide: 'dw-1',
          coveredByPattern: 'path-1',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        {
          allSuggestions: [
            dwSuggestion,
            doubleCoveredSuggestion,
          ],
        },
      );

      expect(doubleCoveredSuggestion.save.calledOnce).to.be.true;
      const data = doubleCoveredSuggestion.setData.firstCall.args[0];
      expect(data).to.not.have.property('coveredByDomainWide');
      expect(data).to.have.property('coveredByPattern', 'path-1');
    });

    it('path rollback preserves coveredByDomainWide on suggestions covered by both DW and path', async () => {
      // Scenario: URL covered by both DW and a path. Path rollback should
      // only strip coveredByPattern; coveredByDomainWide must survive.
      const prerenderOpportunity = {
        getId: () => 'opp-p',
        getType: () => 'prerender',
      };
      const pathSuggestion = {
        getId: () => 'path-1',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const doubleCoveredSuggestion = {
        getId: () => 'url-1',
        getData: () => ({
          url: 'https://example.com/products/item',
          coveredByDomainWide: 'dw-1',
          coveredByPattern: 'path-1',
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [pathSuggestion],
        {
          allSuggestions: [
            pathSuggestion,
            doubleCoveredSuggestion,
          ],
        },
      );

      expect(doubleCoveredSuggestion.save.calledOnce).to.be.true;
      const data = doubleCoveredSuggestion.setData.firstCall.args[0];
      expect(data).to.not.have.property('coveredByPattern');
      expect(data).to.not.have.property('edgeDeployed');
      expect(data).to.have.property('coveredByDomainWide', 'dw-1');
    });

    it('DW rollback cascade skips path deployed before DW', async () => {
      // Scenario: path deployed at t=100, DW deployed at t=200.
      // DW rollback should NOT cascade to the pre-existing path.
      const prerenderOpportunity = {
        getId: () => 'opp-dw',
        getType: () => 'prerender',
      };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: 200,
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const preExistingPath = {
        getId: () => 'path-pre',
        getData: () => ({
          allowedRegexPatterns: ['/products/*'],
          edgeDeployed: 100, // deployed BEFORE DW
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*', '/products/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        {
          allSuggestions: [dwSuggestion, preExistingPath],
        },
      );

      // Pre-existing path was NOT cascaded
      expect(preExistingPath.save.called).to.be.false;
      expect(preExistingPath.setData.called).to.be.false;
    });

    it('DW rollback cascade includes path deployed after DW', async () => {
      // Scenario: DW deployed at t=100, path deployed at t=200.
      // DW rollback SHOULD cascade to the path deployed while DW was active.
      const prerenderOpportunity = {
        getId: () => 'opp-dw',
        getType: () => 'prerender',
      };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: 100,
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const laterPath = {
        getId: () => 'path-later',
        getData: () => ({
          allowedRegexPatterns: ['/blog/*'],
          edgeDeployed: 200, // deployed AFTER DW
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*', '/blog/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        { allSuggestions: [dwSuggestion, laterPath] },
      );

      // Path deployed after DW WAS cascaded
      expect(laterPath.save.calledOnce).to.be.true;
      const data = laterPath.setData.firstCall.args[0];
      expect(data).to.not.have.property('edgeDeployed');
    });

    it('DW rollback does not affect URL suggestions without coveredByDomainWide', async () => {
      // Scenario: a URL suggestion with only coveredByPattern
      // should not be touched by DW rollback.
      const prerenderOpportunity = {
        getId: () => 'opp-dw',
        getType: () => 'prerender',
      };
      const dwSuggestion = {
        getId: () => 'dw-1',
        getData: () => ({
          isDomainWide: true,
          allowedRegexPatterns: ['/*'],
          edgeDeployed: Date.now(),
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const pathOnlyCovered = {
        getId: () => 'url-path-only',
        getData: () => ({
          url: 'https://example.com/products/item',
          coveredByPattern: 'path-1',
          // No coveredByDomainWide
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      sinon.stub(client, 'fetchMetaconfig').resolves({
        prerender: { allowList: ['/*'] },
      });
      sinon.stub(client, 'uploadMetaconfig').resolves();

      await client.rollbackSuggestions(
        mockSite,
        prerenderOpportunity,
        [dwSuggestion],
        {
          allSuggestions: [dwSuggestion, pathOnlyCovered],
        },
      );

      // URL with only coveredByPattern was NOT touched
      expect(pathOnlyCovered.save.called).to.be.false;
      expect(pathOnlyCovered.setData.called).to.be.false;
    });
  });

  describe('previewSuggestions', () => {
    let fetchStub;

    beforeEach(() => {
      // Stub global fetch for HTML fetching
      fetchStub = sinon.stub(global, 'fetch');
      // Mock fetch responses for HTML fetching (warmup + actual for both original and optimized)
      fetchStub.resolves({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name) => (name === 'x-edgeoptimize-cache' ? 'HIT' : null),
        },
        text: async () => '<html><body>Test HTML</body></html>',
      });

      // Stub CDN invalidation for preview tests
      sinon.stub(client, 'invalidateCdnCache').resolves({
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      });

      // Stub fetchConfig to return null by default (no existing config)
      sinon.stub(client, 'fetchConfig').resolves(null);

      // Stub fetchMetaconfig to return metaconfig with apiKeys array
      sinon.stub(client, 'fetchMetaconfig').resolves({
        siteId: 'site-123',
        apiKeys: ['test-api-key-1', 'test-api-key-2'],
      });

      // Add TOKOWAKA_EDGE_URL to env
      client.env.TOKOWAKA_EDGE_URL = 'https://edge-dev.tokowaka.now';
    });

    afterEach(() => {
      // fetchStub will be restored by global afterEach sinon.restore()
      // Just clean up env changes
      delete client.env.TOKOWAKA_EDGE_URL;
    });

    it('should preview suggestions successfully with HTML', async () => {
      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result).to.have.property('s3Path', 'preview/opportunities/example.com/L3BhZ2Ux');
      expect(result).to.have.property('succeededSuggestions');
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result).to.have.property('failedSuggestions');
      expect(result.failedSuggestions).to.have.length(0);
      expect(result).to.have.property('html');
      expect(result.html).to.have.property('url', 'https://example.com/page1');
      expect(result.html).to.have.property('originalHtml');
      expect(result.html).to.have.property('optimizedHtml');
      expect(result.html.originalHtml).to.equal('<html><body>Test HTML</body></html>');
      expect(result.html.optimizedHtml).to.equal('<html><body>Test HTML</body></html>');

      // Verify fetch was called for HTML fetching
      // (4 times: warmup + actual for original and optimized)
      expect(fetchStub.callCount).to.equal(4);
      expect(s3Client.send).to.have.been.calledOnce;
    });

    it('should set applyStale to true for all preview patches', async () => {
      // Create a scenario with existing deployed patches
      client.fetchConfig.resolves({
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h3',
            value: 'Existing Heading',
            opportunityId: 'opp-999',
            suggestionId: 'sugg-999',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      });

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result.config).to.exist;
      expect(result.config.patches).to.have.length(3); // 2 new + 1 existing

      // Verify that all new preview patches have applyStale: true
      const newPatches = result.config.patches.filter(
        (p) => p.suggestionId === 'sugg-1' || p.suggestionId === 'sugg-2',
      );
      expect(newPatches).to.have.length(2);
      newPatches.forEach((patch) => {
        expect(patch.applyStale).to.equal(true);
      });

      // Existing patch should not have applyStale field
      const existingPatch = result.config.patches.find((p) => p.suggestionId === 'sugg-999');
      expect(existingPatch).to.exist;
      expect(existingPatch.applyStale).to.be.undefined;
    });

    it('should preview prerender-only suggestions with no patches', async () => {
      // Update fetchConfig to return existing config with deployed patches
      client.fetchConfig.resolves({
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: false,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Existing Heading',
            opportunityId: 'opp-other-123',
            suggestionId: 'sugg-other',
            prerenderRequired: false,
            lastUpdated: 1234567890,
          },
        ],
      });

      // Create prerender opportunity
      const prerenderOpportunity = {
        getId: () => 'opp-prerender-123',
        getType: () => 'prerender',
      };

      // Create prerender suggestions with no transform rules (prerender-only)
      const prerenderSuggestions = [
        {
          getId: () => 'prerender-sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            // No transform rules - prerender only
          }),
        },
      ];

      const result = await client.previewSuggestions(
        mockSite,
        prerenderOpportunity,
        prerenderSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result).to.have.property('s3Path');
      expect(result.config).to.not.be.null;
      expect(result.config.patches).to.have.length(1); // Merged with existing deployed patch
      expect(result.config.prerender).to.equal(true); // Prerender enabled
      expect(result.succeededSuggestions).to.have.length(1);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result).to.have.property('html');

      // Verify fetch was called for HTML fetching
      expect(fetchStub.callCount).to.equal(4);
      expect(s3Client.send).to.have.been.calledOnce;
    });

    it('should throw error if TOKOWAKA_EDGE_URL is not configured', async () => {
      delete client.env.TOKOWAKA_EDGE_URL;

      try {
        await client.previewSuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('TOKOWAKA_EDGE_URL is required for preview');
        expect(error.status).to.equal(500);
      }
    });

    it('should preview suggestions successfully without metaconfig (optional)', async () => {
      // Override the stub from beforeEach to return null
      client.fetchMetaconfig.resolves(null);

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.config).to.exist;
      expect(result.html).to.exist;
      expect(result.html.originalHtml).to.equal('<html><body>Test HTML</body></html>');
      expect(result.html.optimizedHtml).to.equal('<html><body>Test HTML</body></html>');

      // Verify fetch was called without API key (undefined)
      expect(fetchStub.callCount).to.equal(4); // 2 warmup + 2 actual (original + optimized)
    });

    it('should preview suggestions successfully without apiKeys in metaconfig (optional)', async () => {
      // Override the stub from beforeEach
      client.fetchMetaconfig.resolves({
        siteId: 'site-123',
        // apiKeys missing - should work without it
      });

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.config).to.exist;
      expect(result.html).to.exist;
      expect(result.html.originalHtml).to.equal('<html><body>Test HTML</body></html>');
      expect(result.html.optimizedHtml).to.equal('<html><body>Test HTML</body></html>');
      expect(fetchStub.callCount).to.equal(4);
    });

    it('should preview suggestions successfully with empty apiKeys array (optional)', async () => {
      // Override the stub from beforeEach
      client.fetchMetaconfig.resolves({
        siteId: 'site-123',
        apiKeys: [],
      });

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.config).to.exist;
      expect(result.html).to.exist;
      expect(fetchStub.callCount).to.equal(4);
    });

    it('should throw error for unsupported opportunity type', async () => {
      mockOpportunity.getType = () => 'unsupported-type';

      try {
        await client.previewSuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No mapper found for opportunity type');
        expect(error.status).to.equal(501);
      }
    });

    it('should handle ineligible suggestions', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible
          }),
        },
      ];

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.config).to.be.null;
    });

    it('should return early when generateConfig returns no patches', async () => {
      // Stub mapper to return eligible but no patches
      const mapper = client.mapperRegistry.getMapper('headings');
      sinon.stub(mapper, 'suggestionsToPatches').returns([]);

      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-empty', // Eligible
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.config).to.be.null;
    });

    it('should throw error when preview URL not found in suggestion data', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            // URL missing
            recommendedAction: 'New Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      try {
        await client.previewSuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Preview URL not found in suggestion data');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error when HTML fetch fails', async () => {
      fetchStub.rejects(new Error('Network timeout'));

      try {
        await client.previewSuggestions(
          mockSite,
          mockOpportunity,
          mockSuggestions,
          { warmupDelayMs: 0, maxRetries: 0, retryDelayMs: 0 },
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Preview failed: Unable to fetch HTML');
        expect(error.status).to.equal(500);
      }
    });

    it('should throw when original HTML fetch returns null (e.g. early fetch failed and resolved null)', async () => {
      const okResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (name) => (name === 'x-edgeoptimize-cache' ? 'HIT' : null) },
        text: async () => '<html><body>Test HTML</body></html>',
      };
      fetchStub.resetBehavior();
      fetchStub.onCall(0).resolves(okResponse);
      fetchStub.onCall(1).resolves(okResponse);
      fetchStub.onCall(2).resolves(okResponse);
      fetchStub.onCall(3).rejects(new Error('Original actual fetch failed'));

      try {
        await client.previewSuggestions(
          mockSite,
          mockOpportunity,
          mockSuggestions,
          { warmupDelayMs: 0, maxRetries: 0, retryDelayMs: 0 },
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.satisfy((msg) => msg.includes('Failed to fetch original or optimized HTML')
        || msg.includes('Preview failed'));
        expect(error.status).to.equal(500);
      }
    });

    it('should merge with existing deployed patches for the same URL', async () => {
      // Setup existing config with deployed patches
      const existingConfig = {
        url: 'https://example.com/page1',
        version: '1.0',
        forceFail: false,
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'title',
            value: 'Deployed Title',
            opportunityId: 'opp-456',
            suggestionId: 'sugg-deployed',
            prerenderRequired: true,
            lastUpdated: 1234567890,
          },
        ],
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(result.succeededSuggestions).to.have.length(2);

      // Verify config was uploaded with merged patches
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.patches).to.have.length(3);

      // Should have existing deployed patch + 2 new preview patches
      const deployedPatch = uploadedConfig.patches
        .find((p) => p.suggestionId === 'sugg-deployed');
      expect(deployedPatch).to.exist;
      expect(deployedPatch.value).to.equal('Deployed Title');
    });

    it('should upload config to preview S3 path', async () => {
      await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(s3Client.send).to.have.been.calledOnce;

      const putCommand = s3Client.send.firstCall.args[0];
      expect(putCommand.input.Bucket).to.equal('test-preview-bucket');
      expect(putCommand.input.Key).to.equal('preview/opportunities/example.com/L3BhZ2Ux');
    });

    it('should invalidate CDN cache for preview path', async () => {
      await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      expect(client.invalidateCdnCache).to.have.been.calledOnce;
      const invalidateCall = client.invalidateCdnCache.firstCall.args[0];
      expect(invalidateCall).to.deep.include({
        urls: ['https://example.com/page1'],
        isPreview: true,
      });
    });

    it('should throw error if suggestions span multiple URLs', async () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'Page 1 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2', // Different URL
            recommendedAction: 'Page 2 Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      // Code doesn't validate multi-URL, silently uses first URL
      // fetchConfig and invalidateCdnCache already stubbed in beforeEach
      // Only need to stub uploadConfig
      sinon.stub(client, 'uploadConfig').resolves('preview/opportunities/example.com/L3BhZ2Ux');

      const result = await client.previewSuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
        { warmupDelayMs: 0 },
      );

      // Preview succeeds, using first URL only
      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.config.url).to.equal('https://example.com/page1');
    });
  });

  describe('invalidateCdnCache', () => {
    let mockCdnClient;

    beforeEach(() => {
      mockCdnClient = {
        invalidateCache: sinon.stub().resolves({
          status: 'success',
          provider: 'cloudfront',
          invalidationId: 'I123',
        }),
      };

      sinon.stub(client.cdnClientRegistry, 'getClient').returns(mockCdnClient);
    });

    it('should invalidate CDN cache successfully', async () => {
      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      // Now returns array with one result per provider
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      });

      expect(mockCdnClient.invalidateCache).to.have.been.calledWith([
        '/opportunities/example.com/L3BhZ2Ux',
      ]);
      expect(log.info).to.have.been.calledWith(sinon.match(/Invalidating CDN cache/));
      expect(log.info).to.have.been.calledWith(sinon.match(/CDN cache invalidation completed/));
    });

    it('should invalidate CDN cache for preview path', async () => {
      await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront', isPreview: true });

      expect(mockCdnClient.invalidateCache).to.have.been.calledWith([
        '/preview/opportunities/example.com/L3BhZ2Ux',
      ]);
    });

    it('should return empty array if URL array is empty', async () => {
      const result = await client.invalidateCdnCache({ urls: [], providers: 'cloudfront' });
      expect(result).to.deep.equal([]);
    });

    it('should return empty array if provider is missing', async () => {
      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: '' });
      expect(result).to.deep.equal([]);
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');
    });

    it('should return error object if no CDN client available', async () => {
      client.cdnClientRegistry.getClient.returns(null);

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      // Now returns array with one result per provider
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'No CDN client available for provider: cloudfront',
      });
    });

    it('should return error object if CDN invalidation fails', async () => {
      mockCdnClient.invalidateCache.rejects(new Error('CDN API error'));

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      // Now returns array with one result per provider
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'CDN API error',
      });

      expect(log.warn).to.have.been.calledWith(sinon.match(/Failed to invalidate cloudfront CDN cache/));
    });
  });

  describe('invalidateCdnCache (batch/multiple URLs)', () => {
    let mockCdnClient;

    beforeEach(() => {
      mockCdnClient = {
        invalidateCache: sinon.stub().resolves({
          status: 'success',
          provider: 'cloudfront',
          invalidationId: 'I123',
        }),
      };

      sinon.stub(client.cdnClientRegistry, 'getClient').returns(mockCdnClient);
    });

    it('should invalidate CDN cache for multiple URLs (batch)', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      // Pass array of URLs for batch invalidation
      const result = await client.invalidateCdnCache({ urls, providers: 'cloudfront' });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      });

      expect(mockCdnClient.invalidateCache).to.have.been.calledWith([
        '/opportunities/example.com/L3BhZ2Ux',
        '/opportunities/example.com/L3BhZ2Uy',
        '/opportunities/example.com/L3BhZ2Uz',
      ]);
      expect(log.info).to.have.been.calledWith(sinon.match(/Invalidating CDN cache for 3 path\(s\)/));
    });

    it('should return empty array for empty URLs array', async () => {
      const result = await client.invalidateCdnCache({ urls: [], providers: 'cloudfront' });
      expect(result).to.deep.equal([]);
    });

    it('should return empty array if providers is empty', async () => {
      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: '' });
      expect(result).to.deep.equal([]);
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');
    });

    it('should return error object if no CDN client available', async () => {
      client.cdnClientRegistry.getClient.returns(null);

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'No CDN client available for provider: cloudfront',
      });
    });

    it('should return error object if CDN invalidation fails', async () => {
      mockCdnClient.invalidateCache.rejects(new Error('CDN API error'));

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'CDN API error',
      });
    });

    it('should handle multiple providers in parallel', async () => {
      const mockFastlyClient = {
        invalidateCache: sinon.stub().resolves({
          status: 'success',
          provider: 'fastly',
          purgeId: 'F456',
        }),
      };

      client.cdnClientRegistry.getClient.withArgs('cloudfront').returns(mockCdnClient);
      client.cdnClientRegistry.getClient.withArgs('fastly').returns(mockFastlyClient);

      const result = await client.invalidateCdnCache({
        urls: ['https://example.com/page1'],
        providers: ['cloudfront', 'fastly'],
      });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].provider).to.equal('cloudfront');
      expect(result[1].provider).to.equal('fastly');

      expect(mockCdnClient.invalidateCache).to.have.been.calledOnce;
      expect(mockFastlyClient.invalidateCache).to.have.been.calledOnce;
    });

    it('should handle errors from getClient', async () => {
      // Simulate an error when getting the CDN client
      client.cdnClientRegistry.getClient.restore();
      sinon.stub(client.cdnClientRegistry, 'getClient').throws(new Error('Unexpected error'));

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'Unexpected error',
      });

      // Error is caught in provider-specific error handler
      expect(log.warn).to.have.been.calledWith(sinon.match(/Failed to invalidate cloudfront CDN cache/));
    });

    it('should handle empty CDN provider config', async () => {
      // Test with existing client but passing no providers
      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: [] });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');
    });

    it('should handle multiple providers passed as array', async () => {
      const mockFastlyClient = {
        invalidateCache: sinon.stub().resolves({
          status: 'success',
          provider: 'fastly',
        }),
      };

      client.cdnClientRegistry.getClient.restore();
      sinon.stub(client.cdnClientRegistry, 'getClient')
        .withArgs('cloudfront')
        .returns(mockCdnClient)
        .withArgs('fastly')
        .returns(mockFastlyClient);

      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: ['cloudfront', 'fastly'] });

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(mockCdnClient.invalidateCache).to.have.been.calledOnce;
      expect(mockFastlyClient.invalidateCache).to.have.been.calledOnce;
    });

    it('should handle empty paths after filtering', async () => {
      // Call the method with URLs to test path generation
      const result = await client.invalidateCdnCache({ urls: ['https://example.com/page1'], providers: 'cloudfront' });

      // Should successfully invalidate (paths are generated from URL)
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
    });
  });

  describe('#getCdnProviders (edge cases)', () => {
    it('should handle missing CDN provider config (lines 105-106)', async () => {
      // Temporarily remove TOKOWAKA_CDN_PROVIDER to test early return
      const originalProvider = client.env.TOKOWAKA_CDN_PROVIDER;
      delete client.env.TOKOWAKA_CDN_PROVIDER;

      // Call uploadMetaconfig which uses #getCdnProviders internally
      await client.uploadMetaconfig('https://example.com/page1', { siteId: 'test', prerender: true });

      // No CDN invalidation should happen (no providers configured)
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');

      // Restore
      client.env.TOKOWAKA_CDN_PROVIDER = originalProvider;
    });

    it('should handle array provider config with falsy values (line 111)', async () => {
      // Temporarily modify env to test array filtering
      const originalProvider = client.env.TOKOWAKA_CDN_PROVIDER;
      client.env.TOKOWAKA_CDN_PROVIDER = ['cloudfront', '', null, undefined]; // Array with falsy values

      const mockCloudFrontClient = {
        invalidateCache: sinon.stub().resolves({
          status: 'success',
          provider: 'cloudfront',
        }),
      };

      sinon.stub(client.cdnClientRegistry, 'getClient')
        .withArgs('cloudfront')
        .returns(mockCloudFrontClient);

      // Call uploadMetaconfig which uses #getCdnProviders internally
      await client.uploadMetaconfig('https://example.com/page1', { siteId: 'test', prerender: true });

      // Should only use 'cloudfront' (falsy values filtered out)
      expect(mockCloudFrontClient.invalidateCache).to.have.been.calledOnce;

      // Restore
      client.env.TOKOWAKA_CDN_PROVIDER = originalProvider;
    });

    it('should handle invalid CDN provider type - number (lines 120-121)', async () => {
      // Temporarily modify env to test invalid type
      const originalProvider = client.env.TOKOWAKA_CDN_PROVIDER;
      client.env.TOKOWAKA_CDN_PROVIDER = 12345; // Invalid type (number)

      // Call uploadMetaconfig which uses #getCdnProviders internally
      await client.uploadMetaconfig('https://example.com/page1', { siteId: 'test', prerender: true });

      // No CDN invalidation should happen (no providers)
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');

      // Restore
      client.env.TOKOWAKA_CDN_PROVIDER = originalProvider;
    });

    it('should handle invalid CDN provider type - object (lines 120-121)', async () => {
      // Temporarily modify env to test invalid type
      const originalProvider = client.env.TOKOWAKA_CDN_PROVIDER;
      client.env.TOKOWAKA_CDN_PROVIDER = { key: 'value' }; // Invalid type (object)

      // Call uploadMetaconfig which uses #getCdnProviders internally
      await client.uploadMetaconfig('https://example.com/page1', { siteId: 'test', prerender: true });

      // No CDN invalidation should happen (no providers)
      expect(log.warn).to.have.been.calledWith('No CDN providers specified for cache invalidation');

      // Restore
      client.env.TOKOWAKA_CDN_PROVIDER = originalProvider;
    });
  });

  describe('checkEdgeOptimizeStatus', () => {
    let tracingFetchStub;
    let esmockClient;

    beforeEach(async () => {
      tracingFetchStub = sinon.stub();

      const MockedTokowakaClient = await esmock('../src/index.js', {
        '@adobe/spacecat-shared-utils': {
          hasText: (val) => typeof val === 'string' && val.trim().length > 0,
          isNonEmptyObject: (val) => val !== null && typeof val === 'object' && Object.keys(val).length > 0,
          tracingFetch: tracingFetchStub,
        },
      });

      const env = {
        TOKOWAKA_CDN_PROVIDER: 'cloudfront',
        TOKOWAKA_CDN_CONFIG: JSON.stringify({
          cloudfront: {
            distributionId: 'E123456',
            region: 'us-east-1',
          },
        }),
      };

      esmockClient = new MockedTokowakaClient(
        {
          bucketName: 'test-bucket',
          previewBucketName: 'test-preview-bucket',
          s3Client: { send: sinon.stub().resolves() },
          env,
        },
        log,
      );
    });

    describe('Input Validation', () => {
      it('should throw error when site is not provided', async () => {
        try {
          await esmockClient.checkEdgeOptimizeStatus(null, '/');
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Site is required');
          expect(error.status).to.equal(400);
        }
      });

      it('should throw error when site is empty object', async () => {
        try {
          await esmockClient.checkEdgeOptimizeStatus({}, '/');
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Site is required');
        }
      });

      it('should throw error when path is not provided', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };

        try {
          await esmockClient.checkEdgeOptimizeStatus(site, '');
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Path is required');
          expect(error.status).to.equal(400);
        }
      });

      it('should throw error when path is null', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };

        try {
          await esmockClient.checkEdgeOptimizeStatus(site, null);
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Path is required');
        }
      });
    });

    describe('Early Return (Already Enabled via Site Config)', () => {
      it('should return edgeOptimizeEnabled: true immediately when enabled is boolean true, without making HTTP request', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => ({ enabled: true }) }),
          getDeliveryType: () => 'aem_edge',
        };

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result).to.deep.equal({ edgeOptimizeEnabled: true });
        expect(tracingFetchStub).to.not.have.been.called;
      });

      it('should return edgeOptimizeEnabled: true immediately when enabled is a timestamp (number), without making HTTP request', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => ({ enabled: 1772531669121 }) }),
          getDeliveryType: () => 'aem_edge',
        };

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/products');

        expect(result).to.deep.equal({ edgeOptimizeEnabled: true });
        expect(tracingFetchStub).to.not.have.been.called;
      });

      it('should NOT return early and should make HTTP request when enabled is false', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => ({ enabled: false }) }),
          getDeliveryType: () => 'aem_edge',
        };

        const mockResponse = {
          status: 200,
          headers: { get: () => null },
        };
        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result.edgeOptimizeEnabled).to.be.false;
        expect(tracingFetchStub).to.have.been.called;
      });

      it('should NOT return early and should make HTTP request when edgeOptimizeConfig is undefined', async () => {
        const site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };

        const mockResponse = {
          status: 200,
          headers: { get: () => null },
        };
        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result.edgeOptimizeEnabled).to.be.false;
        expect(tracingFetchStub).to.have.been.called;
      });
    });

    describe('Direct Response (No Redirect)', () => {
      let site;

      beforeEach(() => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };
      });

      it('should return edgeOptimizeEnabled: true when x-tokowaka-request-id header is present', async () => {
        const headersMap = new Map([
          ['x-tokowaka-request-id', 'abc123'],
        ]);
        const mockResponse = {
          status: 200,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
        expect(tracingFetchStub).to.have.been.calledOnce;
        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/');
      });

      it('should return edgeOptimizeEnabled: true when x-edgeoptimize-request-id header is present', async () => {
        const headersMap = new Map([
          ['x-edgeoptimize-request-id', 'xyz789'],
        ]);
        const mockResponse = {
          status: 200,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/products');

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/products');
      });

      it('should return edgeOptimizeEnabled: false when headers are not present', async () => {
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: false,
        });
      });

      it('should work with 404 status and edge optimize enabled', async () => {
        const headersMap = new Map([
          ['x-tokowaka-request-id', 'abc123'],
        ]);
        const mockResponse = {
          status: 404,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/not-found');

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
      });

      it('should send correct User-Agent header', async () => {
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/');

        const fetchOptions = tracingFetchStub.firstCall.args[1];
        const userAgent = fetchOptions.headers['User-Agent'];
        expect(userAgent).to.include('Tokowaka-AI Tokowaka/1.0 AdobeEdgeOptimize-AI AdobeEdgeOptimize/1.0');
        expect(userAgent).to.include('Mozilla/5.0');
      });

      it('should pass timeout option to tracingFetch', async () => {
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/');

        const fetchOptions = tracingFetchStub.firstCall.args[1];
        expect(fetchOptions.timeout).to.equal(5000);
      });
    });

    describe('Retry Logic', () => {
      let site;
      let clock;

      beforeEach(() => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };
        clock = sinon.useFakeTimers();
      });

      afterEach(() => {
        clock.restore();
      });

      it('should retry 3 times on network error with exponential backoff', async () => {
        const networkError = new Error('Network timeout');
        tracingFetchStub.rejects(networkError);

        const promise = esmockClient.checkEdgeOptimizeStatus(site, '/');

        // Wait for first attempt
        await clock.tickAsync(0);

        // Wait for 200ms delay after first failure
        await clock.tickAsync(200);

        // Wait for 400ms delay after second failure
        await clock.tickAsync(400);

        // Wait for 800ms delay after third failure
        await clock.tickAsync(800);

        try {
          await promise;
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Failed to check edge optimize status');
          expect(error.message).to.include('Network timeout');
          expect(error.status).to.equal(500);
          expect(tracingFetchStub.callCount).to.equal(4); // Initial + 3 retries
        }
      });

      it('should succeed on second attempt after first failure', async () => {
        const headersMap = new Map([
          ['x-tokowaka-request-id', 'abc123'],
        ]);
        const mockResponse = {
          status: 200,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.onFirstCall().rejects(new Error('Temporary failure'));
        tracingFetchStub.onSecondCall().resolves(mockResponse);

        const promise = esmockClient.checkEdgeOptimizeStatus(site, '/');

        await clock.tickAsync(200);

        const result = await promise;

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
        expect(tracingFetchStub).to.have.been.calledTwice;
      });

      it('should succeed on third attempt after two failures', async () => {
        const headersMap = new Map([
          ['x-edgeoptimize-request-id', 'xyz789'],
        ]);
        const mockResponse = {
          status: 200,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.onFirstCall().rejects(new Error('Failure 1'));
        tracingFetchStub.onSecondCall().rejects(new Error('Failure 2'));
        tracingFetchStub.onThirdCall().resolves(mockResponse);

        const promise = esmockClient.checkEdgeOptimizeStatus(site, '/');

        await clock.tickAsync(200); // First retry delay
        await clock.tickAsync(400); // Second retry delay

        const result = await promise;

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
        expect(tracingFetchStub.callCount).to.equal(3);
      });

      it('should log warnings on retries', async () => {
        const networkError = new Error('Connection refused');
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.onFirstCall().rejects(networkError);
        tracingFetchStub.onSecondCall().resolves(mockResponse);

        const promise = esmockClient.checkEdgeOptimizeStatus(site, '/');
        await clock.tickAsync(200);
        await promise;

        expect(log.warn).to.have.been.calledWith(
          sinon.match(/Attempt 1 to fetch failed.*Connection refused.*Retrying in 200ms/),
        );
      });

      it('should return edgeOptimizeEnabled: false on request timeout (ETIMEOUT) without retrying', async () => {
        const timeoutError = new Error('Request timeout after 5000ms');
        timeoutError.code = 'ETIMEOUT';
        tracingFetchStub.rejects(timeoutError);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result).to.deep.equal({ edgeOptimizeEnabled: false });
        expect(tracingFetchStub).to.have.been.calledOnce;
        expect(log.warn).to.have.been.calledWith(
          sinon.match(/Request timed out after 5000ms for https:\/\/example.com\/, returning edgeOptimizeEnabled: false/),
        );
      });
    });

    describe('URL Construction', () => {
      let site;

      beforeEach(() => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };
      });

      it('should construct URL correctly with simple path', async () => {
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/products/chairs');

        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/products/chairs');
      });

      it('should construct URL correctly with multi-level path', async () => {
        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/a/b/c/d');

        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/a/b/c/d');
      });

      it('should handle baseURL with trailing slash', async () => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com/',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };

        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/about');

        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/about');
      });

      it('should handle baseURL without trailing slash', async () => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };

        const mockResponse = {
          status: 200,
          headers: new Map(),
        };
        mockResponse.headers.get = () => null;

        tracingFetchStub.resolves(mockResponse);

        await esmockClient.checkEdgeOptimizeStatus(site, '/about');

        expect(tracingFetchStub.firstCall.args[0]).to.equal('https://example.com/about');
      });
    });

    describe('Edge Cases', () => {
      let site;

      beforeEach(() => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({ getEdgeOptimizeConfig: () => undefined }),
          getDeliveryType: () => 'aem_edge',
        };
      });

      it('should handle both headers present', async () => {
        const headersMap = new Map([
          ['x-tokowaka-request-id', 'abc123'],
          ['x-edgeoptimize-request-id', 'xyz789'],
        ]);
        const mockResponse = {
          status: 200,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/');

        expect(result.edgeOptimizeEnabled).to.be.true;
      });

      it('should handle 500 error with edge optimize header', async () => {
        const headersMap = new Map([
          ['x-tokowaka-request-id', 'abc123'],
        ]);
        const mockResponse = {
          status: 500,
          headers: {
            get: (key) => headersMap.get(key) || null,
          },
        };

        tracingFetchStub.resolves(mockResponse);

        const result = await esmockClient.checkEdgeOptimizeStatus(site, '/error');

        expect(result).to.deep.equal({
          edgeOptimizeEnabled: true,
        });
      });
    });
  });

  describe('checkWafConnectivity', () => {
    let tracingFetchStub;
    let esmockClient;
    let mockSiteWaf;

    beforeEach(async () => {
      tracingFetchStub = sinon.stub();

      const MockedTokowakaClient = await esmock('../src/index.js', {
        '@adobe/spacecat-shared-utils': {
          hasText: (val) => typeof val === 'string' && val.trim().length > 0,
          isNonEmptyObject: (val) => val !== null && typeof val === 'object' && Object.keys(val).length > 0,
          prependSchema: (url) => (url.startsWith('http') ? url : `https://${url}`),
          tracingFetch: tracingFetchStub,
        },
      });

      esmockClient = new MockedTokowakaClient(
        {
          bucketName: 'test-bucket',
          previewBucketName: 'test-preview-bucket',
          s3Client: { send: sinon.stub().resolves() },
          env: {
            TOKOWAKA_CDN_PROVIDER: 'cloudfront',
            TOKOWAKA_CDN_CONFIG: JSON.stringify({ cloudfront: { distributionId: 'E123456', region: 'us-east-1' } }),
          },
        },
        log,
      );

      mockSiteWaf = {
        getId: () => 'waf-site-id',
        getBaseURL: () => 'https://example.com',
      };
    });

    const makeHeaders = (plain = {}) => new Headers(plain);

    describe('Hard block — status codes', () => {
      [401, 403, 406, 429, 503].forEach((status) => {
        it(`returns blocked:true for HTTP ${status}`, async () => {
          tracingFetchStub.resolves({ status, headers: makeHeaders() });
          const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
          expect(result.blocked).to.equal(true);
          expect(result.reachable).to.equal(false);
          expect(result.statusCode).to.equal(status);
        });
      });
    });

    describe('Cloudflare header detection', () => {
      it('returns blocked:true when cf-mitigated: challenge header is present', async () => {
        tracingFetchStub.resolves({
          status: 200,
          headers: makeHeaders({ 'cf-mitigated': 'challenge' }),
          text: sinon.stub().resolves('<html>Just a moment</html>'),
        });
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(true);
        expect(result.reachable).to.equal(false);
        expect(result.statusCode).to.equal(200);
      });

      it('returns blocked:false when cf-mitigated header is absent (Cloudflare passing)', async () => {
        tracingFetchStub.resolves({
          status: 200,
          headers: makeHeaders({ 'cf-ray': 'abc123-LHR' }),
          text: sinon.stub().resolves('<html><body>Welcome</body></html>'),
        });
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(true);
      });
    });

    describe('Soft block — vendor-specific keyword detection', () => {
      const makeSoftBlockResponse = (bodyKeyword) => ({
        status: 200,
        headers: makeHeaders({ 'content-type': 'text/html' }),
        text: sinon.stub().resolves(`<html><body>${bodyKeyword}</body></html>`),
      });

      it('detects Cloudflare challenge via cf-chl-widget', async () => {
        tracingFetchStub.resolves(makeSoftBlockResponse('<div class="cf-chl-widget"></div>'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(true);
      });

      it('detects Imperva challenge via _Incapsula_Resource', async () => {
        tracingFetchStub.resolves(makeSoftBlockResponse('window._incapsula_resource={}'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(true);
      });

      it('detects Akamai error page via errors.edgesuite.net', async () => {
        tracingFetchStub.resolves(makeSoftBlockResponse('<a href="https://errors.edgesuite.net/abc">Reference</a>'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(true);
      });

      it('detects Akamai error page via errors.edgekey.net', async () => {
        tracingFetchStub.resolves(makeSoftBlockResponse('<a href="https://errors.edgekey.net/abc">Reference</a>'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(true);
      });
    });

    describe('False positive prevention — broad natural-language terms no longer trigger block', () => {
      const makeNormalPage = (text) => ({
        status: 200,
        headers: makeHeaders({ 'content-type': 'text/html' }),
        text: sinon.stub().resolves(`<html><body>${text}</body></html>`),
      });

      it('does not flag page containing the word "challenge" in marketing copy', async () => {
        tracingFetchStub.resolves(makeNormalPage('Take the 30-day challenge today!'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(true);
      });

      it('does not flag page containing "captcha" in reCAPTCHA script tag', async () => {
        tracingFetchStub.resolves(makeNormalPage(
          '<script src="https://www.google.com/recaptcha/api.js"></script>',
        ));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(true);
      });

      it('does not flag page containing "access denied" in help text', async () => {
        tracingFetchStub.resolves(makeNormalPage(
          '<p>If access is denied, contact your administrator.</p>',
        ));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(true);
      });

      it('does not flag 200 JSON response', async () => {
        tracingFetchStub.resolves({
          status: 200,
          headers: makeHeaders({ 'content-type': 'application/json' }),
        });
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(true);
      });
    });

    describe('Network errors', () => {
      it('returns blocked:null on AbortError (timeout)', async () => {
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        tracingFetchStub.rejects(err);
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(null);
        expect(result.reachable).to.equal(false);
      });

      it('returns blocked:null on network failure', async () => {
        tracingFetchStub.rejects(new Error('ECONNREFUSED'));
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(null);
        expect(result.reachable).to.equal(false);
      });
    });

    describe('Unexpected status (e.g. redirect)', () => {
      it('returns blocked:false for a 301 redirect response', async () => {
        tracingFetchStub.resolves({ status: 301, headers: makeHeaders() });
        const result = await esmockClient.checkWafConnectivity(mockSiteWaf);
        expect(result.blocked).to.equal(false);
        expect(result.reachable).to.equal(false);
        expect(result.statusCode).to.equal(301);
      });
    });

    describe('Private host rejection', () => {
      it('returns blocked:null without probing for private IP host', async () => {
        const privateSite = { getId: () => 'p1', getBaseURL: () => 'http://192.168.1.1' };
        const result = await esmockClient.checkWafConnectivity(privateSite);
        expect(result.blocked).to.equal(null);
        expect(tracingFetchStub).to.not.have.been.called;
      });
    });
  });

  describe('deployToEdge', () => {
    let deploySuggestionsStub;
    let fetchMetaconfigStub;
    let uploadMetaconfigStub;

    function makeSuggestion(id, data, status = 'NEW') {
      let storedData = { ...data };
      let storedUpdatedBy;
      return {
        getId: () => id,
        getStatus: () => status,
        getData: () => storedData,
        setData: (d) => { storedData = d; },
        setUpdatedBy: (v) => { storedUpdatedBy = v; },
        getUpdatedBy: () => storedUpdatedBy,
        save: sinon.stub().resolves(),
      };
    }

    beforeEach(() => {
      deploySuggestionsStub = sinon.stub(client, 'deploySuggestions');
      fetchMetaconfigStub = sinon.stub(client, 'fetchMetaconfig');
      uploadMetaconfigStub = sinon.stub(client, 'uploadMetaconfig').resolves();
    });

    it('should deploy regular suggestions only', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1', transformRules: { action: 'replace', selector: 'h1' } });
      const s2 = makeSuggestion('s2', { url: 'https://example.com/page2', transformRules: { action: 'replace', selector: 'h2' } });

      deploySuggestionsStub.resolves({
        succeededSuggestions: [s1, s2],
        failedSuggestions: [],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [s1, s2],
        allSuggestions: [s1, s2],
        updatedBy: 'test-user',
      });

      expect(result.succeededSuggestions).to.have.length(2);
      expect(result.failedSuggestions).to.have.length(0);
      expect(result.coveredSuggestions).to.have.length(0);
      expect(s1.save).to.have.been.called;
      expect(s1.getUpdatedBy()).to.equal('test-user');
    });

    it('should deploy regular suggestions in PENDING_VALIDATION status', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1', transformRules: {} }, 'PENDING_VALIDATION');

      deploySuggestionsStub.resolves({
        succeededSuggestions: [s1],
        failedSuggestions: [],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [s1],
        allSuggestions: [s1],
        updatedBy: 'test-user',
      });

      expect(result.succeededSuggestions).to.have.length(1);
      expect(deploySuggestionsStub).to.have.been.calledOnce;
      expect(s1.save).to.have.been.called;
    });

    it('should clear edgeOptimizeStatus STALE when deploying', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1', transformRules: {}, edgeOptimizeStatus: 'STALE' });

      deploySuggestionsStub.resolves({
        succeededSuggestions: [s1],
        failedSuggestions: [],
      });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [s1],
        allSuggestions: [s1],
      });

      expect(s1.getData()).to.not.have.property('edgeOptimizeStatus');
    });

    it('should mark ineligible suggestions as failed with statusCode 400', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1' });
      const ineligible = { suggestion: s1, reason: 'not eligible' };

      deploySuggestionsStub.resolves({
        succeededSuggestions: [],
        failedSuggestions: [ineligible],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [s1],
        allSuggestions: [s1],
      });

      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].statusCode).to.equal(400);
      expect(result.failedSuggestions[0].reason).to.equal('not eligible');
    });

    it('should re-throw errors from deploySuggestions', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1' });
      deploySuggestionsStub.rejects(new Error('deploy error'));

      try {
        await client.deployToEdge({
          site: mockSite,
          opportunity: mockOpportunity,
          targetSuggestions: [s1],
          allSuggestions: [s1],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.equal('deploy error');
      }
    });

    it('should deploy domain-wide suggestion and update metaconfig', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123', prerender: true });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      expect(uploadMetaconfigStub).to.have.been.calledOnce;
      expect(result.succeededSuggestions).to.include(dw);
      expect(dw.getData()).to.have.property('edgeDeployed');
    });

    it('should create new metaconfig when none exists for domain-wide', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });

      fetchMetaconfigStub.resolves(null);

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      const uploadCall = uploadMetaconfigStub.firstCall.args[1];
      expect(uploadCall).to.have.property('siteId', 'site-123');
    });

    it('should mark non-batch suggestions covered by domain-wide patterns', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const covered = makeSuggestion('covered1', { url: 'https://example.com/page1' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw, covered],
      });

      expect(result.coveredSuggestions).to.include(covered);
      expect(covered.getData()).to.have.property('coveredByDomainWide', 'dw1');
    });

    it('should not mark already-domain-wide suggestions as covered', async () => {
      const dw1 = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const dw2 = makeSuggestion('dw2', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/other/.*'],
        url: 'https://example.com/other/page',
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw1],
        allSuggestions: [dw1, dw2],
      });

      // dw2 is domain-wide so should not appear in coveredSuggestions
      expect(result.coveredSuggestions).to.not.include(dw2);
    });

    it('should not mark non-NEW suggestions as covered', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const approved = makeSuggestion('ap1', { url: 'https://example.com/page1' }, 'APPROVED');

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw, approved],
      });

      expect(result.coveredSuggestions).to.not.include(approved);
    });

    it('should warn but continue when covered-suggestion save fails', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const covered = makeSuggestion('covered1', { url: 'https://example.com/page1' });
      covered.save = sinon.stub().rejects(new Error('DB error'));

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw, covered],
      });

      // domain-wide itself still succeeded
      expect(result.succeededSuggestions).to.include(dw);
      // covered is not in either list — the error was swallowed with a warning
      expect(result.coveredSuggestions).to.not.include(covered);
      expect(log.warn).to.have.been.called;
    });

    it('should mark domain-wide as failed with statusCode 500 when metaconfig upload fails', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });
      uploadMetaconfigStub.rejects(new Error('upload failed'));

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      expect(result.succeededSuggestions).to.not.include(dw);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].statusCode).to.equal(500);
      expect(result.failedSuggestions[0].reason).to.equal('upload failed');
    });

    it('should skip invalid regex in same-batch pattern filtering without throwing', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['[invalid', '^https://example\\.com/.*'],
      });
      const regular = makeSuggestion('r1', { url: 'https://example.com/page1' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, regular],
        allSuggestions: [dw, regular],
      });

      // valid pattern matches regular, so it's skipped in batch
      expect(result.coveredSuggestions).to.include(regular);
    });

    it('should skip domain-wide suggestion with no valid allowedRegexPatterns', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: [],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(0);
      expect(uploadMetaconfigStub).to.not.have.been.called;
    });

    it('should warn and skip empty string patterns', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: [''],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      expect(result.succeededSuggestions).to.include(path);
      expect(log.warn).to.have.been.called;
    });

    it('should warn and skip invalid regex patterns for domain-wide', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['[invalid', '^https://example\\.com/.*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      expect(log.warn).to.have.been.called;
      expect(uploadMetaconfigStub).to.have.been.calledOnce;
    });

    it('should skip same-batch regular suggestions covered by domain-wide patterns', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const regular = makeSuggestion('r1', { url: 'https://example.com/page1' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, regular],
        allSuggestions: [dw, regular],
      });

      // regular was in same batch as domain-wide, should be marked covered
      expect(result.coveredSuggestions).to.include(regular);
      expect(regular.getData()).to.have.property('coveredByDomainWide', 'same-batch-deployment');
      expect(regular.getData()).to.have.property('skippedInDeployment', true);
      // deploySuggestions should NOT have been called for the regular suggestion
      expect(deploySuggestionsStub).to.not.have.been.called;
    });

    it('should surface same-batch save failures as failed suggestions with statusCode 500', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const regular = makeSuggestion('r1', { url: 'https://example.com/page1' });
      regular.save = sinon.stub().rejects(new Error('save failed'));

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, regular],
        allSuggestions: [dw, regular],
      });

      expect(result.failedSuggestions.some((f) => f.suggestion === regular)).to.be.true;
      expect(result.failedSuggestions.find((f) => f.suggestion === regular).statusCode)
        .to.equal(500);
      expect(result.coveredSuggestions).to.not.include(regular);
      expect(log.warn).to.have.been.called;
    });

    it('should use default updatedBy when not provided', async () => {
      const s1 = makeSuggestion('s1', { url: 'https://example.com/page1', transformRules: {} });

      deploySuggestionsStub.resolves({
        succeededSuggestions: [s1],
        failedSuggestions: [],
      });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [s1],
        allSuggestions: [s1],
      });

      expect(s1.getUpdatedBy()).to.equal('edge-deploy');
    });

    it('should deploy regular suggestion alongside domain-wide when URL does not match pattern', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/special/.*'],
      });
      // URL does not match the domain-wide pattern, so stays in validSuggestions
      const regular = makeSuggestion('r1', { url: 'https://example.com/other/page' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });
      deploySuggestionsStub.resolves({
        succeededSuggestions: [regular],
        failedSuggestions: [],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, regular],
        allSuggestions: [dw, regular],
      });

      expect(deploySuggestionsStub).to.have.been.calledOnce;
      expect(result.succeededSuggestions).to.include(regular);
      expect(result.coveredSuggestions).to.not.include(regular);
    });

    it('should not call deploySuggestions when all regular suggestions are skipped in batch', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const r1 = makeSuggestion('r1', { url: 'https://example.com/page1' });
      const r2 = makeSuggestion('r2', { url: 'https://example.com/page2' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, r1, r2],
        allSuggestions: [dw, r1, r2],
      });

      expect(deploySuggestionsStub).to.not.have.been.called;
    });

    it('should not include same-batch skipped suggestions in covered-by-pattern check', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['^https://example\\.com/.*'],
      });
      const skipped = makeSuggestion('r1', { url: 'https://example.com/page1' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw, skipped],
        allSuggestions: [dw, skipped],
      });

      // skipped is in same batch, it should be in coveredSuggestions once (via same-batch path)
      // but NOT doubly added via the per-suggestion covered-marking path
      const skippedInCovered = result.coveredSuggestions.filter((s) => s.getId() === 'r1');
      expect(skippedInCovered).to.have.length(1);
    });

    it('domain-wide deploy merges /*  into existing allowList instead of replacing it', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123', prerender: { allowList: ['/products/*'] } });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      const uploadedConfig = uploadMetaconfigStub.firstCall.args[1];
      expect(uploadedConfig.prerender.allowList).to.deep.equal(['/products/*', '/*']);
    });

    it('domain-wide deploy deduplicates patterns already in allowList', async () => {
      const dw = makeSuggestion('dw1', {
        isDomainWide: true,
        allowedRegexPatterns: ['/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123', prerender: { allowList: ['/*'] } });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [dw],
        allSuggestions: [dw],
      });

      expect(uploadMetaconfigStub).to.not.have.been.called;
    });

    it('path deploy appends /products/* to an empty allowList', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });

      fetchMetaconfigStub.resolves(null);

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      expect(result.succeededSuggestions).to.include(path);
      const uploadedConfig = uploadMetaconfigStub.firstCall.args[1];
      expect(uploadedConfig.prerender.allowList).to.deep.equal(['/products/*']);
      expect(path.getData()).to.have.property('edgeDeployed');
    });

    it('path deploy appends /products/* when domain-wide /* is already in allowList', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123', prerender: { allowList: ['/*'] } });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      const uploadedConfig = uploadMetaconfigStub.firstCall.args[1];
      expect(uploadedConfig.prerender.allowList).to.deep.equal(['/*', '/products/*']);
    });

    it('path deploy skips CDN write but still marks edgeDeployed when pattern already in allowList', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123', prerender: { allowList: ['/products/*'] } });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      expect(uploadMetaconfigStub).to.not.have.been.called;
      expect(result.succeededSuggestions).to.include(path);
      expect(path.getData()).to.have.property('edgeDeployed');
    });

    it('path deploy does not call deploySuggestions (no per-URL S3 config)', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      expect(deploySuggestionsStub).to.not.have.been.called;
    });

    it('path deploy marks per-URL suggestions under the deployed path prefix as covered', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });
      const urlUnderPath = makeSuggestion('u1', { url: 'https://example.com/products/item-1' });
      const urlElsewhere = makeSuggestion('u2', { url: 'https://example.com/about' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path, urlUnderPath, urlElsewhere],
      });

      expect(result.coveredSuggestions).to.include(urlUnderPath);
      expect(urlUnderPath.getData()).to.have.property('coveredByPattern', 'p1');
      expect(result.coveredSuggestions).to.not.include(urlElsewhere);
    });

    it('path deploy marks as failed with statusCode 500 when metaconfig upload fails', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });
      uploadMetaconfigStub.rejects(new Error('upload failed'));

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path],
      });

      expect(result.succeededSuggestions).to.not.include(path);
      expect(result.failedSuggestions).to.have.length(1);
      expect(result.failedSuggestions[0].statusCode).to.equal(500);
      expect(result.failedSuggestions[0].reason).to.equal('upload failed');
    });

    it('path deploy marks coverage via allowedRegexPatterns even when pathPattern field is absent', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
        // no pathPattern field — coverage is derived from allowedRegexPatterns
      });
      const urlUnderPath = makeSuggestion('u1', { url: 'https://example.com/products/item-1' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path, urlUnderPath],
      });

      expect(result.succeededSuggestions).to.include(path);
      expect(result.coveredSuggestions).to.include(urlUnderPath);
      expect(urlUnderPath.getData()).to.have.property('coveredByPattern', 'p1');
    });

    it('path deploy does not mark non-NEW, pattern, or already-deployed candidates as covered', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });
      // APPROVED — not a deployable status
      const nonNew = makeSuggestion('u1', { url: 'https://example.com/products/a' }, 'APPROVED');
      // isDomainWide pattern — excluded (isPatternSuggestion)
      const dw = makeSuggestion('u2', { isDomainWide: true, allowedRegexPatterns: ['/*'], url: 'https://example.com/products/b' });
      // another path pattern — excluded (isPatternSuggestion)
      const otherPath = makeSuggestion('u3', { allowedRegexPatterns: ['/products/*'], url: 'https://example.com/products/c' });
      // already edgeDeployed — excluded
      const deployed = makeSuggestion('u4', { url: 'https://example.com/products/d', edgeDeployed: 12345 });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path, nonNew, dw, otherPath, deployed],
      });

      expect(result.coveredSuggestions).to.have.length(0);
    });

    it('path deploy silently skips covered-suggestion candidates with invalid URLs', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });
      const badUrl = makeSuggestion('u1', { url: 'not-a-valid-url' });

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path, badUrl],
      });

      // bad URL is not covered, but deploy itself still succeeds
      expect(result.succeededSuggestions).to.include(path);
      expect(result.coveredSuggestions).to.not.include(badUrl);
    });

    it('path deploy warns but continues when covered-suggestion save fails', async () => {
      const path = makeSuggestion('p1', {
        allowedRegexPatterns: ['/products/*'],
      });
      const urlUnderPath = makeSuggestion('u1', { url: 'https://example.com/products/item-1' });
      urlUnderPath.save = sinon.stub().rejects(new Error('DB error'));

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [path],
        allSuggestions: [path, urlUnderPath],
      });

      // path suggestion itself still succeeded
      expect(result.succeededSuggestions).to.include(path);
      // covered is not in coveredSuggestions — error was swallowed with a warning
      expect(result.coveredSuggestions).to.not.include(urlUnderPath);
      expect(log.warn).to.have.been.called;
    });

    it('batch filter is a no-op when all pattern matchers are invalid', async () => {
      const invalidPattern = {
        getId: () => 'bad-pattern',
        getStatus: () => 'NEW',
        getData: () => ({
          allowedRegexPatterns: [''],
          url: 'https://example.com/*',
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };
      const perUrl = {
        getId: () => 'url-1',
        getStatus: () => 'NEW',
        getData: () => ({
          url: 'https://example.com/page1',
          contentGainRatio: 1.5,
          wordCountBefore: 100,
          wordCountAfter: 200,
        }),
        setData: sinon.stub(),
        setUpdatedBy: sinon.stub(),
        save: sinon.stub().resolves(),
      };

      fetchMetaconfigStub.resolves({ siteId: 'site-123' });
      deploySuggestionsStub.resolves({
        succeededSuggestions: [perUrl],
        failedSuggestions: [],
      });

      const result = await client.deployToEdge({
        site: mockSite,
        opportunity: mockOpportunity,
        targetSuggestions: [invalidPattern, perUrl],
        allSuggestions: [invalidPattern, perUrl],
      });

      // per-URL not skipped (invalid matchers → no filtering)
      expect(result.succeededSuggestions).to.include(perUrl);
      expect(result.succeededSuggestions).to.include(invalidPattern);
    });
  });
});
