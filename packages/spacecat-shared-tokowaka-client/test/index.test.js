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
    };

    client = new TokowakaClient(
      { bucketName: 'test-bucket', s3Client },
      log,
    );

    mockSite = {
      getId: () => 'site-123',
      getBaseURL: () => 'https://example.com',
      getConfig: () => ({ tokowakaApiKey: 'test-api-key-123' }),
    };

    mockOpportunity = {
      getId: () => 'opp-123',
      getType: () => 'headings',
    };

    mockSuggestions = [
      {
        getId: () => 'sugg-1',
        getData: () => ({
          url: 'https://example.com/page1',
          headingTag: 'h1',
          recommendedAction: 'New Heading',
          checkType: 'heading-empty',
        }),
      },
      {
        getId: () => 'sugg-2',
        getData: () => ({
          url: 'https://example.com/page1',
          headingTag: 'h2',
          recommendedAction: 'New Subtitle',
          checkType: 'heading-empty',
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
        .to.throw('TOKOWAKA_CONFIG_BUCKET is required');
    });

    it('should throw error if s3Client is missing', () => {
      expect(() => new TokowakaClient({ bucketName: 'test-bucket' }, log))
        .to.throw('S3 client is required');
    });
  });

  describe('createFrom', () => {
    it('should create client from context', () => {
      const context = {
        env: { TOKOWAKA_CONFIG_BUCKET: 'test-bucket' },
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
        env: { TOKOWAKA_CONFIG_BUCKET: 'test-bucket' },
        s3Client,
        log,
        tokowakaClient: existingClient,
      };

      const createdClient = TokowakaClient.createFrom(context);

      expect(createdClient).to.equal(existingClient);
    });
  });

  describe('generateConfig', () => {
    it('should generate config for headings opportunity', () => {
      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

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
        suggestionId: 'sugg-1',
        prerenderRequired: true,
      });
      expect(patch).to.have.property('lastUpdated');
    });

    it('should group suggestions by URL path', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            headingTag: 'h1',
            recommendedAction: 'Page 1 Heading',
          }),
        },
        {
          getId: () => 'sugg-2',
          getData: () => ({
            url: 'https://example.com/page2',
            headingTag: 'h1',
            recommendedAction: 'Page 2 Heading',
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(2);
      expect(config.tokowakaOptimizations).to.have.property('/page1');
      expect(config.tokowakaOptimizations).to.have.property('/page2');
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

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/does not have a URL/));
    });

    it('should skip suggestions with invalid URL', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'not-a-valid-url',
            selector: 'h1',
            value: 'Heading',
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/Invalid URL/));
    });

    it('should skip suggestions with missing required fields', () => {
      mockSuggestions = [
        {
          getId: () => 'sugg-1',
          getData: () => ({
            url: 'https://example.com/page1',
            // Missing headingTag and recommendedAction
          }),
        },
      ];

      const config = client.generateConfig(mockSite, mockOpportunity, mockSuggestions);

      expect(Object.keys(config.tokowakaOptimizations)).to.have.length(0);
      expect(log.warn).to.have.been.calledWith(sinon.match(/has invalid data/));
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

      expect(() => client.generateConfig(mockSite, mockOpportunity, mockSuggestions))
        .to.throw(/No mapper found for opportunity type: unsupported-type/)
        .with.property('status', 501);
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

      expect(s3Key).to.equal('test-api-key/v1/tokowaka-site-config.json');
      expect(s3Client.send).to.have.been.calledOnce;

      const command = s3Client.send.firstCall.args[0];
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('test-api-key/v1/tokowaka-site-config.json');
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

  describe('deploySuggestions', () => {
    it('should deploy suggestions successfully', async () => {
      const result = await client.deploySuggestions(
        mockSite,
        mockOpportunity,
        mockSuggestions,
      );

      expect(result).to.have.property('tokowakaApiKey', 'test-api-key-123');
      expect(result).to.have.property('s3Key', 'test-api-key-123/v1/tokowaka-site-config.json');
      expect(result).to.have.property('config');
      expect(result.config.siteId).to.equal('site-123');
      expect(s3Client.send).to.have.been.calledOnce;
    });

    it('should throw error if site does not have Tokowaka API key', async () => {
      mockSite.getConfig = () => ({});

      try {
        await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Tokowaka API key configured');
        expect(error.status).to.equal(400);
      }
    });

    it('should log progress during deployment', async () => {
      await client.deploySuggestions(mockSite, mockOpportunity, mockSuggestions);

      expect(log.info).to.have.been.calledWith(sinon.match(/Generating Tokowaka config/));
      expect(log.info).to.have.been.calledWith(sinon.match(/Uploading Tokowaka config/));
      expect(log.info).to.have.been.calledWith(sinon.match(/Successfully uploaded/));
    });
  });
});
