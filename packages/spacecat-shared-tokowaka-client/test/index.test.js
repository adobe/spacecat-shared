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

    it('should include prerender in metaconfig when options.prerender is non-empty object', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const prerenderConfig = { enabled: true, paths: ['/products/*'] };
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, { prerender: prerenderConfig });

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal(prerenderConfig);

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal(prerenderConfig);
    });

    it('should NOT include prerender when options.prerender is empty object', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, { prerender: {} });

      expect(result).to.not.have.property('prerender');

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body).to.not.have.property('prerender');
    });

    it('should NOT include prerender when options.prerender is undefined', async () => {
      const siteId = 'site-123';
      const url = 'https://www.example.com/page1';
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.onFirstCall().rejects(noSuchKeyError);

      const result = await client.createMetaconfig(url, siteId, {});

      expect(result).to.not.have.property('prerender');

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body).to.not.have.property('prerender');
    });

    it('should NOT include prerender when options is not provided', async () => {
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
      expect(uploadCommand.input.Metadata).to.deep.equal({ isStageDomain: true });
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
      // Mock fetchMetaconfig to return existing config
      s3Client.send.onFirstCall().resolves({
        Body: {
          transformToString: sinon.stub().resolves(JSON.stringify(existingMetaconfig)),
        },
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
      expect(uploadCommand.input.Metadata).to.deep.equal({ isStageDomain: true });
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
      });

      const result = await client.updateMetaconfig(url, siteId, {});

      expect(result).to.have.property('prerender');
      expect(result.prerender).to.deep.equal({ allowList: ['/path/*'] });

      const uploadCommand = s3Client.send.secondCall.args[0];
      const body = JSON.parse(uploadCommand.input.Body);
      expect(body.prerender).to.deep.equal({ allowList: ['/path/*'] });
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
          getConfig: () => ({}),
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
          getConfig: () => ({}),
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

    describe('Direct Response (No Redirect)', () => {
      let site;

      beforeEach(() => {
        site = {
          getId: () => 'site-id',
          getBaseURL: () => 'https://example.com',
          getConfig: () => ({}),
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
        expect(fetchOptions.headers['User-Agent']).to.equal('Tokowaka-AI Tokowaka/1.0 AdobeEdgeOptimize-AI AdobeEdgeOptimize/1.0');
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
          getConfig: () => ({}),
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
          getConfig: () => ({}),
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
          getConfig: () => ({}),
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
          getConfig: () => ({}),
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
          getConfig: () => ({}),
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
});
