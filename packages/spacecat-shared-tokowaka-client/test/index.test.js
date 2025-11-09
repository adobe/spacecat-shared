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
      { bucketName: 'test-bucket', s3Client, env },
      log,
    );

    mockSite = {
      getId: () => 'site-123',
      getBaseURL: () => 'https://example.com',
      getConfig: () => ({
        getTokowakaConfig: () => ({ apiKey: 'test-api-key-123' }),
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
      expect(client.bucketName).to.equal('test-bucket');
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
  });

  describe('createFrom', () => {
    it('should create client from context', () => {
      const context = {
        env: { TOKOWAKA_SITE_CONFIG_BUCKET: 'test-bucket' },
        s3: { s3Client },
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
        suggestionToPatch() {
          return {};
        }

        // eslint-disable-next-line class-methods-use-this
        validateSuggestionData() {
          return true;
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
    it('should generate config for headings opportunity', () => {
      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(config).to.deep.include({
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
      });

      expect(config.tokowakaOptimizations).to.have.property('/page1');
      expect(config.tokowakaOptimizations['/page1'].prerender).to.be.true;
      expect(config.tokowakaOptimizations['/page1'].patches).to.have.length(2);

      const patch = config.tokowakaOptimizations['/page1'].patches[0];
      expect(patch).to.include({
        op: 'replace',
        selector: 'h1',
        value: 'New Heading',
        opportunityId: 'opp-123',
        prerenderRequired: true,
      });
      expect(patch.suggestionIds).to.deep.equal(['sugg-1']);
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

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(config).to.deep.include({
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
      });

      expect(config.tokowakaOptimizations).to.have.property('/page1');
      expect(config.tokowakaOptimizations['/page1'].prerender).to.be.true;
      expect(config.tokowakaOptimizations['/page1'].patches).to.have.length(1);

      const patch = config.tokowakaOptimizations['/page1'].patches[0];
      expect(patch).to.include({
        op: 'appendChild',
        selector: 'main',
        opportunityId: 'opp-faq-123',
        prerenderRequired: true,
      });
      expect(patch.suggestionIds).to.deep.equal(['sugg-faq-1', 'sugg-faq-2']);
      expect(patch).to.have.property('lastUpdated');
    });

    it('should group suggestions by URL path', () => {
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

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(2);
      expect(config.tokowakaOptimizations).to.have.property('/page1');
      expect(config.tokowakaOptimizations).to.have.property('/page2');
    });

    it('should use overrideBaseURL from fetchConfig when available', () => {
      // Set up mockSite with overrideBaseURL
      mockSite.getConfig = () => ({
        getTokowakaConfig: () => ({
          apiKey: 'test-api-key-123',
          cdnProvider: 'cloudfront',
        }),
        getFetchConfig: () => ({
          overrideBaseURL: 'https://override.example.com',
        }),
      });

      mockSuggestions = [
        {
          getId: () => 'sugg-override',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: '/relative-path',
            recommendedAction: 'Heading',
            checkType: 'heading-empty',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(1);
      expect(config.tokowakaOptimizations).to.have.property('/relative-path');
    });

    it('should skip suggestions without URL', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            selector: 'h1',
            value: 'Heading without URL',
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/does not have a URL/));
    });

    it('should skip suggestions with invalid URL', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'http://invalid domain with spaces.com',
            checkType: 'heading-empty',
            recommendedAction: 'Heading',
            transformRules: {
              action: 'replace',
              selector: 'h1',
            },
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/Failed to extract pathname from URL/));
    });

    it('should skip suggestions with missing required fields', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            // Missing required fields
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/cannot be deployed/));
    });

    it('should handle unsupported opportunity types', () => {
      mockOpportunity.getType = () => 'unsupported-type';
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
          }),
        },
      ];

      expect(() => client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null))
        .to.throw(/No mapper found for opportunity type: unsupported-type/)
        .with.property('status', 501);
    });

    it('should generate config without allOpportunitySuggestions', () => {
      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions, null);

      expect(config).to.deep.include({
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
      });

      expect(config.tokowakaOptimizations).to.have.property('/page1');
    });
  });

  describe('uploadConfig', () => {
    it('should upload config to S3', async () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {},
      };

      const s3Key = await client.uploadConfig('test-api-key', config);

      expect(s3Key).to.equal('opportunities/test-api-key');
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/test-api-key');
      expect(command.input.ContentType).to.equal('application/json');
      expect(JSON.parse(command.input.Body)).to.deep.equal(config);
    });

    it('should throw error if apiKey is missing', async () => {
      const config = { siteId: 'site-123' };

      try {
        await client.uploadConfig('', config);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Tokowaka API key is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should throw error if config is empty', async () => {
      try {
        await client.uploadConfig('test-api-key', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Config object is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 upload failure', async () => {
      s3Client.send.rejects(new Error('Network error'));
      const config = { siteId: 'site-123', tokowakaOptimizations: {} };

      try {
        await client.uploadConfig('test-api-key', config);
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
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Old Heading',
                opportunityId: 'opp-123',
                suggestionIds: ['sugg-1'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
            ],
          },
        },
      };

      s3Client.send.resolves({
        Body: {
          transformToString: async () => JSON.stringify(existingConfig),
        },
      });

      const config = await client.fetchConfig('test-api-key');

      expect(config).to.deep.equal(existingConfig);
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('opportunities/test-api-key');
    });

    it('should return null if config does not exist', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      s3Client.send.rejects(noSuchKeyError);

      const config = await client.fetchConfig('test-api-key');

      expect(config).to.be.null;
    });

    it('should return null if S3 returns NoSuchKey error code', async () => {
      const noSuchKeyError = new Error('The specified key does not exist');
      noSuchKeyError.Code = 'NoSuchKey';
      s3Client.send.rejects(noSuchKeyError);

      const config = await client.fetchConfig('test-api-key');

      expect(config).to.be.null;
    });

    it('should throw error if apiKey is missing', async () => {
      try {
        await client.fetchConfig('');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Tokowaka API key is required');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle S3 fetch failure', async () => {
      s3Client.send.rejects(new Error('Network error'));

      try {
        await client.fetchConfig('test-api-key');
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
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Old Heading',
                opportunityId: 'opp-123',
                suggestionIds: ['sugg-1'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
              {
                op: 'replace',
                selector: 'h2',
                value: 'Old Subtitle',
                opportunityId: 'opp-456',
                suggestionIds: ['sugg-2'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
            ],
          },
        },
      };

      newConfig = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Updated Heading',
                opportunityId: 'opp-123',
                suggestionIds: ['sugg-1'],
                prerenderRequired: true,
                lastUpdated: 1234567900,
              },
            ],
          },
        },
      };
    });

    it('should return new config if existing config is null', () => {
      const merged = client.mergeConfigs(null, newConfig);

      expect(merged).to.deep.equal(newConfig);
    });

    it('should update existing patch with same opportunityId and suggestionId', () => {
      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(2);

      // First patch should be updated
      const updatedPatch = merged.tokowakaOptimizations['/page1'].patches[0];
      expect(updatedPatch.value).to.equal('Updated Heading');
      expect(updatedPatch.lastUpdated).to.equal(1234567900);

      // Second patch should remain unchanged
      const unchangedPatch = merged.tokowakaOptimizations['/page1'].patches[1];
      expect(unchangedPatch.value).to.equal('Old Subtitle');
      expect(unchangedPatch.opportunityId).to.equal('opp-456');
    });

    it('should add new patch if opportunityId and suggestionId do not exist', () => {
      newConfig.tokowakaOptimizations['/page1'].patches.push({
        op: 'replace',
        selector: 'h3',
        value: 'New Section Title',
        opportunityId: 'opp-789',
        suggestionIds: ['sugg-3'],
        prerenderRequired: true,
        lastUpdated: 1234567900,
      });

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(3);

      // New patch should be added at the end
      const newPatch = merged.tokowakaOptimizations['/page1'].patches[2];
      expect(newPatch.value).to.equal('New Section Title');
      expect(newPatch.opportunityId).to.equal('opp-789');
      expect(newPatch.suggestionIds).to.deep.equal(['sugg-3']);
    });

    it('should add new URL path if it does not exist in existing config', () => {
      newConfig.tokowakaOptimizations['/page2'] = {
        prerender: true,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Page 2 Heading',
            opportunityId: 'opp-999',
            suggestionIds: ['sugg-4'],
            prerenderRequired: true,
            lastUpdated: 1234567900,
          },
        ],
      };

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations).to.have.property('/page1');
      expect(merged.tokowakaOptimizations).to.have.property('/page2');
      expect(merged.tokowakaOptimizations['/page2'].patches).to.have.length(1);
      expect(merged.tokowakaOptimizations['/page2'].patches[0].value).to.equal('Page 2 Heading');
    });

    it('should preserve existing URL paths not present in new config', () => {
      existingConfig.tokowakaOptimizations['/page3'] = {
        prerender: false,
        patches: [
          {
            op: 'replace',
            selector: 'h1',
            value: 'Page 3 Heading',
            opportunityId: 'opp-333',
            suggestionIds: ['sugg-5'],
            prerenderRequired: false,
            lastUpdated: 1234567890,
          },
        ],
      };

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations).to.have.property('/page1');
      expect(merged.tokowakaOptimizations).to.have.property('/page3');
      expect(merged.tokowakaOptimizations['/page3'].patches[0].value).to.equal('Page 3 Heading');
    });

    it('should update config metadata from new config', () => {
      newConfig.version = '2.0';
      newConfig.tokowakaForceFail = true;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.version).to.equal('2.0');
      expect(merged.tokowakaForceFail).to.equal(true);
    });

    it('should handle empty patches array in existing config', () => {
      existingConfig.tokowakaOptimizations['/page1'].patches = [];

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(1);
      expect(merged.tokowakaOptimizations['/page1'].patches[0].value).to.equal('Updated Heading');
    });

    it('should handle empty patches array in new config', () => {
      newConfig.tokowakaOptimizations['/page1'].patches = [];

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(2);
      expect(merged.tokowakaOptimizations['/page1'].patches[0].value).to.equal('Old Heading');
    });

    it('should handle missing patches property in existing config', () => {
      delete existingConfig.tokowakaOptimizations['/page1'].patches;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(1);
      expect(merged.tokowakaOptimizations['/page1'].patches[0].value).to.equal('Updated Heading');
    });

    it('should handle missing patches property in new config', () => {
      delete newConfig.tokowakaOptimizations['/page1'].patches;

      const merged = client.mergeConfigs(existingConfig, newConfig);

      expect(merged.tokowakaOptimizations['/page1'].patches).to.have.length(2);
      expect(merged.tokowakaOptimizations['/page1'].patches[0].value).to.equal('Old Heading');
    });
  });

  describe('deploySuggestions', () => {
    beforeEach(() => {
      // Stub CDN invalidation for deploy tests
      sinon.stub(client, 'invalidateCdnCache').resolves({
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      });
      // Stub fetchConfig to return null by default (no existing config)
      sinon.stub(client, 'fetchConfig').resolves(null);
    });

    it('should deploy suggestions successfully', async () => {
      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result).to.have.property('s3Path', 'opportunities/test-api-key-123');
      expect(s3Client.send).to.have.been.calledOnce;
    });

    it('should throw error if site does not have Tokowaka API key', async () => {
      mockSite.getConfig = () => ({
        getTokowakaConfig: () => ({}),
      });

      try {
        await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Tokowaka API key configured');
        expect(error.status).to.equal(400);
      }
    });

    it('should handle suggestions that are not eligible for deployment', async () => {
      // Create suggestions with different checkTypes
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            recommendedAction: 'New Heading',
            checkType: 'heading-missing', // Not eligible (wrong checkType name)
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

    it('should return early when no eligible suggestions', async () => {
      // All suggestions are ineligible
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

    it('should return early when suggestions pass eligibility but fail during config generation', async () => {
      // Suggestions pass canDeploy but have no URL (caught in generateConfig)
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            // Missing URL
            recommendedAction: 'New Heading',
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

      expect(result.succeededSuggestions).to.have.length(0);
      expect(result.failedSuggestions).to.have.length(1);
      expect(s3Client.send).to.not.have.been.called;
    });

    it('should throw error for unsupported opportunity type', async () => {
      mockOpportunity.getType = () => 'unsupported-type';

      try {
        await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No mapper found for opportunity type: unsupported-type');
        expect(error.message).to.include('Supported types:');
        expect(error.status).to.equal(501);
      }
    });

    it('should handle null tokowakaConfig gracefully', async () => {
      mockSite.getConfig = () => ({
        getTokowakaConfig: () => null,
      });

      try {
        await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Tokowaka API key configured');
      }
    });

    it('should use default reason when eligibility has no reason', async () => {
      // Create a mock mapper that returns eligible=false without reason
      const mockMapper = {
        canDeploy: sinon.stub().returns({ eligible: false }), // No reason provided
      };
      sinon.stub(client.mapperRegistry, 'getMapper').returns(mockMapper);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result.failedSuggestions).to.have.length(2);
      expect(result.failedSuggestions[0].reason).to.equal('Suggestion cannot be deployed');
    });

    it('should fetch existing config and merge when deploying', async () => {
      const existingConfig = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h3',
                value: 'Existing Heading',
                opportunityId: 'opp-999',
                suggestionIds: ['sugg-999'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
            ],
          },
        },
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(client.fetchConfig).to.have.been.calledWith('test-api-key-123');
      expect(result).to.have.property('s3Path', 'opportunities/test-api-key-123');

      // Verify the uploaded config contains both existing and new patches
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.tokowakaOptimizations['/page1'].patches).to.have.length(3);
    });

    it('should use new config when no existing config found', async () => {
      client.fetchConfig.resolves(null);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(client.fetchConfig).to.have.been.calledWith('test-api-key-123');
      expect(result).to.have.property('s3Path', 'opportunities/test-api-key-123');

      // Verify only new patches are in the config
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.tokowakaOptimizations['/page1'].patches).to.have.length(2);
    });

    it('should update existing patch when deploying same opportunityId and suggestionId', async () => {
      const existingConfig = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Old Heading Value',
                opportunityId: 'opp-123',
                suggestionIds: ['sugg-1'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
            ],
          },
        },
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result).to.have.property('s3Path', 'opportunities/test-api-key-123');

      // Verify the patch was updated, not duplicated
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.tokowakaOptimizations['/page1'].patches).to.have.length(2);

      // First patch should be updated with new value
      const updatedPatch = uploadedConfig.tokowakaOptimizations['/page1'].patches[0];
      expect(updatedPatch.value).to.equal('New Heading');
      expect(updatedPatch.opportunityId).to.equal('opp-123');
      expect(updatedPatch.suggestionIds).to.deep.equal(['sugg-1']);
      expect(updatedPatch.lastUpdated).to.be.greaterThan(1234567890);
    });

    it('should preserve existing URL paths when merging', async () => {
      const existingConfig = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaForceFail: false,
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Page 1 Heading',
                opportunityId: 'opp-123',
                suggestionIds: ['sugg-1'],
                prerenderRequired: true,
                lastUpdated: 1234567890,
              },
            ],
          },
          '/other-page': {
            prerender: false,
            patches: [
              {
                op: 'replace',
                selector: 'h1',
                value: 'Other Page Heading',
                opportunityId: 'opp-888',
                suggestionIds: ['sugg-888'],
                prerenderRequired: false,
                lastUpdated: 1234567890,
              },
            ],
          },
        },
      };

      client.fetchConfig.resolves(existingConfig);

      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result).to.have.property('s3Path', 'opportunities/test-api-key-123');

      // Verify existing URL paths are preserved
      const uploadedConfig = JSON.parse(s3Client.send.firstCall.args[0].input.Body);
      expect(uploadedConfig.tokowakaOptimizations).to.have.property('/page1');
      expect(uploadedConfig.tokowakaOptimizations).to.have.property('/other-page');
      expect(uploadedConfig.tokowakaOptimizations['/other-page'].patches[0].value)
        .to.equal('Other Page Heading');
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
      const result = await client.invalidateCdnCache('test-api-key', 'cloudfront');

      expect(result).to.deep.equal({
        status: 'success',
        provider: 'cloudfront',
        invalidationId: 'I123',
      });

      expect(mockCdnClient.invalidateCache).to.have.been.calledWith([
        '/opportunities/test-api-key',
      ]);
      expect(log.debug).to.have.been.calledWith(sinon.match(/Invalidating CDN cache/));
      expect(log.info).to.have.been.calledWith(sinon.match(/CDN cache invalidation completed/));
    });

    it('should return null if no CDN configuration', async () => {
      try {
        await client.invalidateCdnCache('', 'cloudfront');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Tokowaka API key and provider are required');
        expect(error.status).to.equal(400);
      }
    });

    it('should return null if CDN config is empty', async () => {
      try {
        await client.invalidateCdnCache('test-api-key', '');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Tokowaka API key and provider are required');
        expect(error.status).to.equal(400);
      }
    });

    it('should return null if CDN provider is missing', async () => {
      try {
        await client.invalidateCdnCache('test-api-key', null);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Tokowaka API key and provider are required');
        expect(error.status).to.equal(400);
      }
    });

    it('should return null if CDN config is missing', async () => {
      try {
        await client.invalidateCdnCache(null, 'cloudfront');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Tokowaka API key and provider are required');
        expect(error.status).to.equal(400);
      }
    });

    it('should return null if no CDN client available', async () => {
      client.cdnClientRegistry.getClient.returns(null);

      const result = await client.invalidateCdnCache('test-api-key', 'cloudfront');

      expect(result).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'No CDN client available for provider: cloudfront',
      });
      expect(log.error).to.have.been.calledWith(sinon.match(/Failed to invalidate Tokowaka CDN cache/));
    });

    it('should return error object if CDN invalidation fails', async () => {
      mockCdnClient.invalidateCache.rejects(new Error('CDN API error'));

      const result = await client.invalidateCdnCache('test-api-key', 'cloudfront');

      expect(result).to.deep.equal({
        status: 'error',
        provider: 'cloudfront',
        message: 'CDN API error',
      });

      expect(log.error).to.have.been.calledWith(sinon.match(/Failed to invalidate Tokowaka CDN cache/));
    });
  });
});
