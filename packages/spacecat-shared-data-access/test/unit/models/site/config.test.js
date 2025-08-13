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

import { expect } from 'chai';

import { Config, validateConfiguration } from '../../../../src/models/site/config.js';
import { registerLogger } from '../../../../src/util/logger-registry.js';

describe('Config Tests', () => {
  beforeEach(() => {
    registerLogger(null);
  });

  describe('Config Creation', () => {
    it('creates an Config with defaults when no data is provided', () => {
      const config = Config();
      expect(config.slack).to.be.undefined;
      expect(config.handlers).to.be.undefined;
    });

    it('creates an Config with provided data when data is valid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
          invitedUserCount: 3,
        },
        handlers: {
          404: {
            mentions: { slack: ['id1'] },
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig().channel).to.equal('channel1');
      expect(config.getSlackConfig().workspace).to.equal('workspace1');
      expect(config.getSlackConfig().invitedUserCount).to.equal(3);
      expect(config.getSlackMentions(404)).to.deep.equal(['id1']);
    });

    it('preserves provided data when validation fails', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        handlers: {
          404: {
            mentions: [{ email: ['id1'] }],
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({
        channel: 'channel1',
        workspace: 'workspace1',
      });
      expect(config.getHandlers()).to.deep.equal({
        404: {
          mentions: [{ email: ['id1'] }],
        },
      });
    });

    it('preserves provided data when invitedUserCount is invalid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
          invitedUserCount: -12,
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({
        channel: 'channel1',
        workspace: 'workspace1',
        invitedUserCount: -12,
      });
      expect(config.getHandlers()).to.be.undefined;
    });

    it('logs error when validation fails and logger is available', () => {
      // Create a mock logger
      const mockLogger = {};

      // Spy on the logger error method
      let loggedError = null;
      let loggedData = null;
      mockLogger.error = (message, data) => {
        loggedError = message;
        loggedData = data;
      };

      // Register the mock logger
      registerLogger(mockLogger);

      const invalidData = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        handlers: {
          404: {
            mentions: [{ email: ['id1'] }], // invalid - should be string array
          },
        },
      };

      const config = Config(invalidData);

      // Should preserve the provided invalid data
      expect(config.getSlackConfig()).to.deep.equal({
        channel: 'channel1',
        workspace: 'workspace1',
      });
      expect(config.getHandlers()).to.deep.equal({
        404: {
          mentions: [{ email: ['id1'] }],
        },
      });

      // Should have logged the error
      expect(loggedError).to.equal('Site configuration validation failed, using provided data');
      expect(loggedData).to.have.property('error');
      expect(loggedData).to.have.property('invalidConfig');
      expect(loggedData.invalidConfig).to.deep.equal(invalidData);
    });

    it('creates a Config with llmo property', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
        },
      };
      const config = Config(data);
      expect(config.getLlmoConfig()).to.deep.equal(data.llmo);
    });

    it('test fetching config with invalid llmo property', () => {
      const data = {
        llmo: {
          dataFolder: 123,
          brand: 'mybrand',
        },
      };
      // Config() catches validation errors and uses provided data as-is
      const config = Config(data);
      expect(config.getLlmoConfig()).to.deep.equal(data.llmo);
    });

    it('creates a Config with llmo property including questions', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
          questions: {
            Human: [
              {
                key: 'foo',
                question: 'What is foo?',
                source: 'manual-csv',
                volume: '100',
                tags: ['tag1', 'tag2', 'market: US', 'product: Product A'],
                importTime: '2021-01-01T00:00:00.000Z',
              },
            ],
            AI: [
              {
                key: 'bar',
                question: 'What is bar?',
                source: 'ahrefs',
                keyword: 'bar',
                url: 'https://example.com',
                volume: '100',
                tags: ['tag3', 'tag4', 'market: US', 'product: Product A'],
                importTime: '2021-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      };
      const config = Config(data);
      expect(config.getLlmoConfig()).to.deep.equal(data.llmo);
    });

    it('creates a Config with llmo property including URL patterns', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
          urlPatterns: [
            { urlPattern: 'https://www.adobe.com/*' },
            { urlPattern: 'https://www.adobe.com/firefly*', tags: ['product: firefly'] },
            { urlPattern: 'https://www.adobe.com/products/firefly*', tags: ['product: firefly'] },
            { urlPattern: 'https://www.adobe.com/fr/*', tags: ['market: fr'] },
            { urlPattern: 'https://www.adobe.com/fr/firefly*', tags: ['product: firefly', 'market: fr'] },
            { urlPattern: 'https://www.adobe.com/fr/products/firefly*', tags: ['product: firefly', 'market: fr'] },
          ],
        },
      };
      const config = Config(data);
      expect(config.getLlmoConfig()).to.deep.equal(data.llmo);
    });

    it('correctly updates the LLMO configuration including questions', () => {
      const config = Config();
      const questions = {
        Human: [
          {
            key: 'foo',
            question: 'What is foo?',
            source: 'manual-csv',
            volume: '100',
            tags: ['tag1', 'tag2', 'market: US', 'product: Product A'],
            importTime: '2021-01-01T00:00:00.000Z',
          },
        ],
        AI: [
          {
            key: 'bar',
            question: 'What is bar?',
            source: 'ahrefs',
            keyword: 'bar',
            url: 'https://example.com',
            volume: '100',
            tags: ['tag3', 'tag4', 'market: US', 'product: Product A'],
            importTime: '2021-01-01T00:00:00.000Z',
          },
        ],
      };
      config.updateLlmoConfig('newBrandFolder', 'newBrand', questions);
      const llmoConfig = config.getLlmoConfig();
      expect(llmoConfig.dataFolder).to.equal('newBrandFolder');
      expect(llmoConfig.brand).to.equal('newBrand');
      expect(llmoConfig.questions.Human[0].key).to.equal('foo');
      expect(llmoConfig.questions.AI[0].key).to.equal('bar');
      expect(llmoConfig.questions.Human[0].tags).to.deep.equal(['tag1', 'tag2', 'market: US', 'product: Product A']);
      expect(llmoConfig.questions.AI[0].tags).to.deep.equal(['tag3', 'tag4', 'market: US', 'product: Product A']);
      expect(llmoConfig.questions).to.deep.equal(questions);
    });

    it('correctly updates the LLMO configuration including URL patterns', () => {
      const config = Config();
      const urlPatterns = [
        { urlPattern: 'https://www.adobe.com/*' },
        { urlPattern: 'https://www.adobe.com/firefly*', tags: ['product: firefly'] },
        { urlPattern: 'https://www.adobe.com/products/firefly*', tags: ['product: firefly'] },
        { urlPattern: 'https://www.adobe.com/fr/*', tags: ['market: fr'] },
        { urlPattern: 'https://www.adobe.com/fr/firefly*', tags: ['product: firefly', 'market: fr'] },
        { urlPattern: 'https://www.adobe.com/fr/products/firefly*', tags: ['product: firefly', 'market: fr'] },
      ];
      config.updateLlmoConfig('newBrandFolder', 'newBrand', undefined, urlPatterns);
      const llmoConfig = config.getLlmoConfig();
      expect(llmoConfig.dataFolder).to.equal('newBrandFolder');
      expect(llmoConfig.brand).to.equal('newBrand');
      expect(llmoConfig.urlPatterns).to.deep.equal(urlPatterns);
    });
  });

  describe('Config Methods', () => {
    it('correctly updates the Slack configuration', () => {
      const config = Config();
      config.updateSlackConfig('newChannel', 'newWorkspace', 20);

      const slackConfig = config.getSlackConfig();
      expect(slackConfig.channel).to.equal('newChannel');
      expect(slackConfig.workspace).to.equal('newWorkspace');
      expect(slackConfig.invitedUserCount).to.equal(20);
    });

    it('correctly updates the LLMO configuration', () => {
      const config = Config();
      config.updateLlmoConfig('newBrandFolder', 'newBrand');

      const llmoConfig = config.getLlmoConfig();
      expect(llmoConfig.dataFolder).to.equal('newBrandFolder');
      expect(llmoConfig.brand).to.equal('newBrand');
    });

    it('correctly updates the Slack mentions', () => {
      const config = Config();
      config.updateSlackMentions('404', ['id1', 'id2']);

      const slackMentions = config.getSlackMentions('404');
      expect(slackMentions).to.deep.equal(['id1', 'id2']);
    });

    it('correctly updates the excluded URLs', () => {
      const config = Config();
      config.updateExcludedURLs('404', ['url1', 'url2']);

      const excludedURLs = config.getExcludedURLs('404');
      expect(excludedURLs).to.deep.equal(['url1', 'url2']);
    });

    it('correctly updates the manual overrides', () => {
      const config = Config();
      const manualOverwrites = [
        { brokenTargetURL: 'url1', targetURL: 'url2' },
        { brokenTargetURL: 'url3', targetURL: 'url4' },
      ];
      config.updateManualOverwrites('broken-backlinks', manualOverwrites);

      const updatedManualOverwrites = config.getManualOverwrites('broken-backlinks');
      expect(updatedManualOverwrites).to.deep.equal(manualOverwrites);
    });

    it('correctly updates the fixedURLs array to an empty array', () => {
      const fixedURLs = [
        { brokenTargetURL: 'https://broken.co', targetURL: 'https://fixed.co' },
        { brokenTargetURL: 'https://broken.link.co', targetURL: 'https://fixed.link.co' },
      ];
      const config = Config();
      config.updateFixedURLs('broken-backlinks', fixedURLs);
      config.updateFixedURLs('broken-backlinks', []);
      expect(config.getFixedURLs('broken-backlinks')).to.be.an('array').that.is.empty;
    });

    it('correctly updates the imports array', () => {
      const config = Config();
      const imports = [
        { type: 'import1' },
        { type: 'import2' },
      ];
      config.updateImports(imports);

      const updatedImports = config.getImports();
      expect(updatedImports).to.deep.equal(imports);
    });

    it('correctly updates the fetchConfig option', () => {
      const config = Config();
      const fetchConfig = {
        headers: {
          'User-Agent': 'custom-agent',
        },
        overrideBaseURL: 'https://example.com',
      };
      config.updateFetchConfig(fetchConfig);
      expect(config.getFetchConfig()).to.deep.equal(fetchConfig);
    });

    it('correctly updates the brandConfig option', () => {
      const config = Config();
      const brandConfig = {
        brandId: 'test-brand',
        userId: 'test-user',
      };
      config.updateBrandConfig(brandConfig);
      expect(config.getBrandConfig()).to.deep.equal(brandConfig);
    });

    it('should fail gracefully if handler is not present in the configuration', () => {
      const config = Config();
      expect(config.getSlackMentions('404')).to.be.undefined;
      expect(config.getHandlerConfig('404')).to.be.undefined;
      expect(config.getExcludedURLs('404')).to.be.undefined;
      expect(config.getManualOverwrites('404')).to.be.undefined;
      expect(config.getFixedURLs('404')).to.be.undefined;
      expect(config.getIncludedURLs('404')).to.be.undefined;
      expect(config.getGroupedURLs('404')).to.be.undefined;
    });

    it('creates a Config with contentAiConfig property', () => {
      const data = {
        contentAiConfig: {
          index: 'test-index',
        },
      };
      const config = Config(data);
      expect(config.getContentAiConfig()).to.deep.equal(data.contentAiConfig);
    });

    it('accepts an empty contentAiConfig object', () => {
      const data = {
        // empty object
        contentAiConfig: {},
      };
      const config = Config(data);
      expect(config.getContentAiConfig()).to.be.an('object');
      expect(config.getContentAiConfig()).to.deep.equal({});
    });

    it('has empty contentAiConfig in default config', () => {
      const config = Config();
      expect(config.getContentAiConfig()).to.deep.equal(undefined);
    });

    it('should return undefined for contentAiConfig if not provided', () => {
      const config = Config({});
      expect(config.getContentAiConfig()).to.be.undefined;
    });

    it('creates a Config with cdnLogsConfig property', () => {
      const data = {
        cdnLogsConfig: {
          bucketName: 'test-bucket',
          filters: [{ key: 'test-key', value: ['test-value'] }],
          outputLocation: 'test-output-location',
        },
      };
      const config = Config(data);
      expect(config.getCdnLogsConfig()).to.deep.equal(data.cdnLogsConfig);
    });

    it('creates a Config with cdnLogsConfig property with filter type', () => {
      const data = {
        cdnLogsConfig: {
          bucketName: 'test-bucket',
          filters: [{ key: 'test-key', value: ['test-value'], type: 'exclude' }],
          outputLocation: 'test-output-location',
        },
      };
      const config = Config(data);
      expect(config.getCdnLogsConfig()).to.deep.equal(data.cdnLogsConfig);
    });

    it('has empty cdnLogsConfig in default config', () => {
      const config = Config();
      expect(config.getCdnLogsConfig()).to.deep.equal(undefined);
    });

    it('should return undefined for cdnLogsConfig if not provided', () => {
      const config = Config({});
      expect(config.getCdnLogsConfig()).to.be.undefined;
    });

    it('should preserve provided data if cdnLogsConfig is invalid', () => {
      const data = {
        cdnLogsConfig: {
          filters: [{ key: 'test-key', value: ['test-value'] }],
          outputLocation: 'test-output-location',
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.be.undefined;
      expect(config.getCdnLogsConfig()).to.deep.equal({
        filters: [{ key: 'test-key', value: ['test-value'] }],
        outputLocation: 'test-output-location',
      });
    });

    it('should be able to update cdnLogsConfig', () => {
      const data = {
        cdnLogsConfig: {
          filters: [{ key: 'test-key', value: 'test-value' }],
          outputLocation: 'test-output-location',
        },
      };
      const config = Config({});
      config.updateCdnLogsConfig(data.cdnLogsConfig);
      expect(config.getCdnLogsConfig()).to.deep.equal(data.cdnLogsConfig);
    });
  });

  describe('Grouped URLs option', () => {
    it('Config creation with the groupedURLs option', () => {
      const groupedURLs = [
        { name: 'catalog', pattern: '/products/' },
        { name: 'blog', pattern: '/post/' },
      ];
      const data = {
        handlers: {
          'broken-backlinks': {
            groupedURLs,
          },
        },
      };
      const config = Config(data);
      expect(config.getGroupedURLs('broken-backlinks')).to.deep.equal(groupedURLs);
    });

    it('Config creation with an incorrect groupedURLs option type preserves provided data', () => {
      const data = {
        handlers: {
          'broken-backlinks': {
            groupedURLs: 'invalid-type',
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'broken-backlinks': {
          groupedURLs: 'invalid-type',
        },
      });
    });

    it('Config creation with an incorrect groupedURLs option structure preserves provided data', () => {
      const data = {
        handlers: {
          'broken-backlinks': {
            groupedURLs: [
              { wrong: 'wrong', structure: 'structure' },
            ],
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'broken-backlinks': {
          groupedURLs: [
            { wrong: 'wrong', structure: 'structure' },
          ],
        },
      });
    });

    it('Config updates grouped URLs with the groupedURLs option', () => {
      const groupedURLs = [
        { name: 'catalog', pattern: '/products/' },
        { name: 'blog', pattern: '/post/' },
      ];
      const config = Config();
      config.updateGroupedURLs('broken-backlinks', groupedURLs);
      expect(config.getGroupedURLs('broken-backlinks')).to.deep.equal(groupedURLs);
    });

    it('Config update with an incorrect groupedURLs option type', () => {
      const groupedURLs = 'invalid-type';
      const config = Config();
      expect(() => config.updateGroupedURLs('broken-backlinks', groupedURLs))
        .to.throw('Configuration validation error: "handlers.broken-backlinks.groupedURLs" must be an array');
      expect(config.getGroupedURLs('broken-backlinks')).to.deep.equal(groupedURLs);
    });

    it('Config update with an incorrect groupedURLs option structure', () => {
      const groupedURLs = [
        { wrong: 'wrong', structure: 'structure' },
      ];
      const config = Config();
      expect(() => config.updateGroupedURLs('broken-backlinks', groupedURLs))
        .to.throw('Configuration validation error: "handlers.broken-backlinks.groupedURLs[0].wrong" is not allowed');
      expect(config.getGroupedURLs('broken-backlinks')).to.deep.equal(groupedURLs);
    });
  });

  describe('Latest Metrics', () => {
    it('should return undefined for latestMetrics if not provided', () => {
      const config = Config();
      expect(config.getLatestMetrics('latest-metrics')).to.be.undefined;
    });

    it('should return the correct latestMetrics if provided', () => {
      const data = {
        handlers: {
          'latest-metrics': {
            latestMetrics: {
              pageViewsChange: 10,
              ctrChange: 5,
              projectedTrafficValue: 1000,
            },
          },
        },
      };
      const config = Config(data);
      const latestMetrics = config.getLatestMetrics('latest-metrics');
      expect(latestMetrics.pageViewsChange).to.equal(10);
      expect(latestMetrics.ctrChange).to.equal(5);
      expect(latestMetrics.projectedTrafficValue).to.equal(1000);
    });

    it('should update the latestMetrics correctly', () => {
      const config = Config();
      const latestMetrics = {
        pageViewsChange: 15,
        ctrChange: 7,
        projectedTrafficValue: 1500,
      };
      config.updateLatestMetrics('latest-metrics', latestMetrics);
      const updatedMetrics = config.getLatestMetrics('latest-metrics');
      expect(updatedMetrics.pageViewsChange).to.equal(15);
      expect(updatedMetrics.ctrChange).to.equal(7);
      expect(updatedMetrics.projectedTrafficValue).to.equal(1500);
    });

    it('should preserve provided data if latestMetrics is invalid', () => {
      const data = {
        handlers: {
          'latest-metrics': {
            latestMetrics: {
              pageViewsChange: 'invalid',
              ctrChange: 5,
              projectedTrafficValue: 1000,
            },
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'latest-metrics': {
          latestMetrics: {
            pageViewsChange: 'invalid',
            ctrChange: 5,
            projectedTrafficValue: 1000,
          },
        },
      });
    });
  });

  describe('fromDynamoItem Static Method', () => {
    it('correctly converts from DynamoDB item', () => {
      const dynamoItem = {
        slack: {
          channel: 'channel1',
          workspace: 'internal',
        },
        handlers: {
          404: {
            mentions: { slack: ['id1'] },
          },
        },
      };
      const config = Config.fromDynamoItem(dynamoItem);
      const slackMentions = config.getSlackMentions(404);
      const slackConfig = config.getSlackConfig();
      const isInternal = config.isInternalCustomer();
      expect(slackConfig.channel).to.equal('channel1');
      expect(slackConfig.workspace).to.equal('internal');
      expect(isInternal).to.equal(true);
      expect(slackMentions[0]).to.equal('id1');
    });
  });

  describe('toDynamoItem Static Method', () => {
    it('correctly converts to DynamoDB item format', () => {
      const data = Config({
        slack: {
          channel: 'channel1',
          workspace: 'external',
        },
        handlers: {
          404: {
            mentions: { slack: ['id1'] },
          },
        },
      });
      const dynamoItem = Config.toDynamoItem(data);
      const slackConfig = dynamoItem.slack;
      const slackMentions = dynamoItem.handlers[404].mentions.slack;
      expect(slackConfig.channel).to.equal('channel1');
      expect(slackConfig.workspace).to.equal('external');
      expect(data.isInternalCustomer()).to.equal(false);
      expect(slackMentions[0]).to.equal('id1');
    });

    it('includes contentAiConfig in toDynamoItem conversion', () => {
      const data = Config({
        contentAiConfig: {
          index: 'test-index',
        },
      });
      const dynamoItem = Config.toDynamoItem(data);
      expect(dynamoItem.contentAiConfig).to.deep.equal(data.getContentAiConfig());
    });

    it('includes llmo in toDynamoItem conversion including questions', () => {
      const data = Config({
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
          questions: {
            Human: [
              {
                question: 'What is foo?',
                source: 'manual-csv',
              },
            ],
            AI: [
              {
                question: 'What is bar?',
                source: 'ahrefs',
                keyword: 'bar',
                url: 'https://example.com',
              },
            ],
          },
        },
      });
      const dynamoItem = Config.toDynamoItem(data);
      expect(dynamoItem.llmo).to.deep.equal(data.getLlmoConfig());
    });
  });

  describe('Import Configuration', () => {
    it('validates import types against schemas', () => {
      const data = {
        imports: [{
          type: 'organic-keywords',
          destinations: ['default'],
          sources: ['ahrefs'],
          enabled: true,
          pageUrl: 'https://example.com',
        }],
      };
      const config = Config(data);
      expect(config.getImports()).to.deep.equal(data.imports);
    });

    it('preserves provided data for unknown import type', () => {
      const config = Config({
        imports: [{
          type: 'unknown-type',
          destinations: ['default'],
          sources: ['ahrefs'],
        }],
      });
      expect(config.getImports()).to.deep.equal([{
        type: 'unknown-type',
        destinations: ['default'],
        sources: ['ahrefs'],
      }]);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.be.undefined;
    });

    it('preserves provided data for invalid import configuration', () => {
      const config = Config({
        imports: [{
          type: 'organic-keywords',
          destinations: ['invalid'],
          sources: ['invalid'],
        }],
      });

      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.be.undefined;
      expect(config.getImports()).to.deep.equal([{
        type: 'organic-keywords',
        destinations: ['invalid'],
        sources: ['invalid'],
      }]);
    });

    describe('enableImport method', () => {
      it('enables import with default config', () => {
        const config = Config();
        config.enableImport('organic-keywords');

        const importConfig = config.getImportConfig('organic-keywords');
        expect(importConfig).to.deep.equal({
          type: 'organic-keywords',
          destinations: ['default'],
          sources: ['ahrefs'],
          enabled: true,
        });
      });

      it('enables cwv-daily import with default config', () => {
        const config = Config();
        config.enableImport('cwv-daily');

        const importConfig = config.getImportConfig('cwv-daily');
        expect(importConfig).to.deep.equal({
          type: 'cwv-daily',
          destinations: ['default'],
          sources: ['rum'],
          enabled: true,
        });
      });

      it('enables cwv-weekly import with default config', () => {
        const config = Config();
        config.enableImport('cwv-weekly');

        const importConfig = config.getImportConfig('cwv-weekly');
        expect(importConfig).to.deep.equal({
          type: 'cwv-weekly',
          destinations: ['default'],
          sources: ['rum'],
          enabled: true,
        });
      });

      it('enables import with custom config', () => {
        const config = Config();
        config.enableImport('organic-keywords', {
          pageUrl: 'https://example.com',
          sources: ['google'],
        });

        const importConfig = config.getImportConfig('organic-keywords');
        expect(importConfig).to.deep.equal({
          type: 'organic-keywords',
          destinations: ['default'],
          sources: ['google'],
          enabled: true,
          pageUrl: 'https://example.com',
        });
      });

      it('throws error for unknown import type', () => {
        const config = Config();
        expect(() => config.enableImport('unknown-type'))
          .to.throw('Unknown import type: unknown-type');
      });

      it('throws error for invalid config', () => {
        const config = Config();
        expect(() => config.enableImport('organic-keywords', {
          sources: ['invalid-source'],
        })).to.throw('Invalid import config');
      });

      it('replaces existing import of same type', () => {
        const config = Config({
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
          }],
        });

        config.enableImport('organic-keywords', {
          sources: ['google'],
        });

        const imports = config.getImports();
        expect(imports).to.have.length(1);
        expect(imports[0].sources).to.deep.equal(['google']);
      });
    });

    describe('disableImport method', () => {
      it('disables existing import', () => {
        const config = Config({
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
          }],
        });

        config.disableImport('organic-keywords');
        expect(config.isImportEnabled('organic-keywords')).to.be.false;
      });

      it('handles disabling non-existent import', () => {
        const config = Config();
        config.disableImport('organic-keywords');
        expect(config.isImportEnabled('organic-keywords')).to.be.false;
      });

      it('preserves other imports when disabling one import', () => {
        const config = Config({
          imports: [
            {
              type: 'organic-keywords',
              destinations: ['default'],
              sources: ['ahrefs'],
              enabled: true,
            },
            {
              type: 'organic-traffic',
              destinations: ['default'],
              sources: ['ahrefs'],
              enabled: true,
            },
          ],
        });

        config.disableImport('organic-keywords');

        const imports = config.getImports();
        expect(imports).to.have.length(2);
        expect(imports).to.deep.equal([
          {
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: false,
          },
          {
            type: 'organic-traffic',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
          },
        ]);
      });
    });

    describe('getImportConfig method', () => {
      it('returns config for existing import', () => {
        const importConfig = {
          type: 'organic-keywords',
          destinations: ['default'],
          sources: ['ahrefs'],
          enabled: true,
        };
        const config = Config({
          imports: [importConfig],
        });

        expect(config.getImportConfig('organic-keywords')).to.deep.equal(importConfig);
      });

      it('returns undefined for non-existent import', () => {
        const config = Config();
        expect(config.getImportConfig('organic-keywords')).to.be.undefined;
      });
    });

    describe('isImportEnabled method', () => {
      it('returns true for enabled import', () => {
        const config = Config({
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
          }],
        });
        expect(config.isImportEnabled('organic-keywords')).to.be.true;
      });

      it('returns false for disabled import', () => {
        const config = Config({
          imports: [{
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: false,
          }],
        });
        expect(config.isImportEnabled('organic-keywords')).to.be.false;
      });

      it('returns false for non-existent import', () => {
        const config = Config();
        expect(config.isImportEnabled('organic-keywords')).to.be.false;
      });
    });
  });

  describe('validateConfiguration Function', () => {
    it('validates a minimal configuration', () => {
      const config = {
        slack: {},
        handlers: {},
      };
      const validated = validateConfiguration(config);
      expect(validated).to.deep.equal(config);
    });

    it('validates a complete configuration with all options', () => {
      const config = {
        slack: {
          channel: 'test-channel',
          workspace: 'test-workspace',
          invitedUserCount: 5,
        },
        handlers: {
          404: {
            mentions: { slack: ['user1', 'user2'] },
            excludedURLs: ['https://example.com/excluded'],
            manualOverwrites: [{ brokenTargetURL: 'old', targetURL: 'new' }],
            fixedURLs: [{ brokenTargetURL: 'broken', targetURL: 'fixed' }],
            includedURLs: ['https://example.com/included'],
            groupedURLs: [{ name: 'group1', pattern: '/pattern/' }],
            latestMetrics: {
              pageViewsChange: 10,
              ctrChange: 5,
              projectedTrafficValue: 1000,
            },
          },
        },
        imports: [
          {
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            pageUrl: 'https://example.com',
            enabled: false,
            geo: 'us',
            limit: 5,
          },
          {
            type: 'organic-traffic',
            destinations: ['default'],
            sources: ['ahrefs', 'google'],
            enabled: true,
          },
          {
            type: 'all-traffic',
            destinations: ['default'],
            sources: ['rum'],
            enabled: true,
          },
          {
            type: 'top-pages',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
            geo: 'us',
            limit: 100,
          },
          {
            type: 'cwv-daily',
            destinations: ['default'],
            sources: ['rum'],
            enabled: true,
          },
          {
            type: 'cwv-weekly',
            destinations: ['default'],
            sources: ['rum'],
            enabled: true,
          },
        ],
        fetchConfig: {
          headers: {
            'User-Agent': 'test-agent',
          },
          overrideBaseURL: 'https://example.com',
        },
        brandConfig: {
          brandId: 'test-brand',
          userId: 'test-user',
        },
      };
      const validated = validateConfiguration(config);
      expect(validated).to.deep.equal(config);
    });

    it('throws error for invalid slack configuration', () => {
      const config = {
        slack: {
          invitedUserCount: 'not-a-number',
        },
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "slack.invitedUserCount" must be a number');
    });

    it('throws error for invalid handler configuration', () => {
      const config = {
        handlers: {
          404: {
            mentions: 'not-an-object',
          },
        },
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "handlers.404.mentions" must be of type object');
    });

    it('throws error for invalid import configuration', () => {
      const config = {
        imports: [
          {
            type: 'organic-keywords',
            destinations: ['invalid'],
            sources: ['invalid-source'],
            enabled: true,
          },
        ],
      };
      expect(() => validateConfiguration(config))
        .to.throw().and.satisfy((error) => {
          expect(error.message).to.include('Configuration validation error');
          expect(error.cause.details[0].context.message)
            .to.equal('"imports[0].type" must be [llmo-prompts-ahrefs]. "imports[0].destinations[0]" must be [default]. "imports[0].type" must be [organic-keywords-nonbranded]. "imports[0].type" must be [organic-keywords-ai-overview]. "imports[0].type" must be [organic-keywords-feature-snippets]. "imports[0].type" must be [organic-keywords-questions]. "imports[0].type" must be [organic-traffic]. "imports[0].type" must be [all-traffic]. "imports[0].type" must be [top-pages]. "imports[0].type" must be [cwv-daily]. "imports[0].type" must be [cwv-weekly]. "imports[0].type" must be [traffic-analysis]. "imports[0].type" must be [top-forms]');
          expect(error.cause.details[0].context.details)
            .to.eql([
              {
                message: '"imports[0].type" must be [llmo-prompts-ahrefs]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['llmo-prompts-ahrefs'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].destinations[0]" must be [default]',
                path: ['imports', 0, 'destinations', 0],
                type: 'any.only',
                context: {
                  valids: ['default'],
                  label: 'imports[0].destinations[0]',
                  value: 'invalid',
                  key: 0,
                },
              }, {
                message: '"imports[0].type" must be [organic-keywords-nonbranded]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['organic-keywords-nonbranded'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [organic-keywords-ai-overview]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['organic-keywords-ai-overview'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [organic-keywords-feature-snippets]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['organic-keywords-feature-snippets'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [organic-keywords-questions]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['organic-keywords-questions'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [organic-traffic]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['organic-traffic'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [all-traffic]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['all-traffic'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [top-pages]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['top-pages'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [cwv-daily]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['cwv-daily'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [cwv-weekly]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['cwv-weekly'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [traffic-analysis]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['traffic-analysis'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              }, {
                message: '"imports[0].type" must be [top-forms]',
                path: ['imports', 0, 'type'],
                type: 'any.only',
                context: {
                  valids: ['top-forms'],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
            ]);
          return true;
        });
    });

    it('throws error for invalid fetchConfig headers', () => {
      const config = {
        fetchConfig: {
          headers: 'not-an-object',
        },
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "fetchConfig.headers" must be of type object');
    });

    it('throws error for invalid brandConfig', () => {
      const config = {
        brandConfig: {},
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "brandConfig.brandId" is required');
    });

    it('throws error for invalid brandConfig userId', () => {
      const config = {
        brandConfig: {
          brandId: 'test-brand',
        },
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "brandConfig.userId" is required');
    });

    it('throws error for invalid fetchConfig overrideBaseUrl', () => {
      const config = {
        fetchConfig: {
          overrideBaseURL: 'not-a-url',
        },
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "fetchConfig.overrideBaseURL" must be a valid uri');
    });

    it('validates multiple import types with different configurations', () => {
      const config = {
        imports: [
          {
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
            limit: 100,
            pageUrl: 'https://example.com',
          },
          {
            type: 'top-pages',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: false,
            geo: 'global',
          },
        ],
      };
      const validated = validateConfiguration(config);
      expect(validated).to.deep.equal(config);
    });

    it('validates optional url in the import configuration', () => {
      const config = {
        imports: [
          {
            type: 'organic-keywords',
            destinations: ['default'],
            sources: ['ahrefs'],
            enabled: true,
            url: 'https://example.com',
          },
        ],
      };
      const validated = validateConfiguration(config);
      expect(validated).to.deep.equal(config);
    });

    it('throws error for missing required import fields', () => {
      const config = {
        imports: [
          {
            type: 'organic-keywords',
            // missing required destinations and sources
            enabled: true,
          },
        ],
      };
      expect(() => validateConfiguration(config))
        .to.throw('Configuration validation error: "imports[0]" does not match any of the allowed types');
    });
  });

  describe('Threshold Configuration', () => {
    it('should accept valid movingAvgThreshold and percentageChangeThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: 10,
            percentageChangeThreshold: 20,
          },
        },
      };
      const config = Config(data);
      const handlerConfig = config.getHandlerConfig('organic-traffic-internal');
      expect(handlerConfig.movingAvgThreshold).to.equal(10);
      expect(handlerConfig.percentageChangeThreshold).to.equal(20);
    });

    it('should preserve provided data for negative movingAvgThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: -5,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'organic-traffic-internal': {
          movingAvgThreshold: -5,
        },
      });
    });

    it('should preserve provided data for zero movingAvgThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: 0,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'organic-traffic-internal': {
          movingAvgThreshold: 0,
        },
      });
    });

    it('should preserve provided data for negative percentageChangeThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            percentageChangeThreshold: -10,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'organic-traffic-internal': {
          percentageChangeThreshold: -10,
        },
      });
    });

    it('should preserve provided data for zero percentageChangeThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            percentageChangeThreshold: 0,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.be.undefined;
      expect(config.getHandlers()).to.deep.equal({
        'organic-traffic-internal': {
          percentageChangeThreshold: 0,
        },
      });
    });

    it('should allow updating threshold values', () => {
      // Create a config with an initial empty handlers object
      const config = Config({
        handlers: {
          'organic-traffic-internal': {},
        },
      });
      const handlerType = 'organic-traffic-internal';
      // Initially handler config exists but without thresholds
      const initialConfig = config.getHandlerConfig(handlerType);
      expect(initialConfig).to.exist;
      expect(initialConfig.movingAvgThreshold).to.be.undefined;
      expect(initialConfig.percentageChangeThreshold).to.be.undefined;
      // We need to create a new config with the thresholds
      // since we can't modify the existing one directly
      const updatedConfig = Config({
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: 15,
            percentageChangeThreshold: 25,
          },
        },
      });
      // Verify thresholds were set in the new config
      const handlerConfig = updatedConfig.getHandlerConfig(handlerType);
      expect(handlerConfig.movingAvgThreshold).to.equal(15);
      expect(handlerConfig.percentageChangeThreshold).to.equal(25);
    });
  });

  describe('LLMO Question Management', () => {
    let config;

    beforeEach(() => {
      config = Config();
    });

    describe('getLlmoDataFolder', () => {
      it('should return undefined when llmo config does not exist', () => {
        expect(config.getLlmoDataFolder()).to.be.undefined;
      });

      it('should return dataFolder when llmo config exists', () => {
        config.updateLlmoConfig('/test/folder', 'testBrand');
        expect(config.getLlmoDataFolder()).to.equal('/test/folder');
      });
    });

    describe('getLlmoBrand', () => {
      it('should return undefined when llmo config does not exist', () => {
        expect(config.getLlmoBrand()).to.be.undefined;
      });

      it('should return brand when llmo config exists', () => {
        config.updateLlmoConfig('/test/folder', 'testBrand');
        expect(config.getLlmoBrand()).to.equal('testBrand');
      });
    });

    describe('updateLlmoDataFolder', () => {
      it('should create llmo config if it does not exist and set dataFolder', () => {
        config.updateLlmoDataFolder('/new/folder');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.dataFolder).to.equal('/new/folder');
        expect(llmoConfig.brand).to.be.undefined;
      });

      it('should update dataFolder when llmo config already exists', () => {
        // First create llmo config
        config.updateLlmoConfig('/old/folder', 'oldBrand');

        // Then update dataFolder
        config.updateLlmoDataFolder('/new/folder');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.dataFolder).to.equal('/new/folder');
        expect(llmoConfig.brand).to.equal('oldBrand'); // Should preserve existing brand
      });

      it('should update dataFolder multiple times', () => {
        config.updateLlmoDataFolder('/first/folder');
        config.updateLlmoDataFolder('/second/folder');
        config.updateLlmoDataFolder('/third/folder');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.dataFolder).to.equal('/third/folder');
      });
    });

    describe('updateLlmoBrand', () => {
      it('should create llmo config if it does not exist and set brand', () => {
        config.updateLlmoBrand('newBrand');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.brand).to.equal('newBrand');
        expect(llmoConfig.dataFolder).to.be.undefined;
      });

      it('should update brand when llmo config already exists', () => {
        // First create llmo config
        config.updateLlmoConfig('/old/folder', 'oldBrand');

        // Then update brand
        config.updateLlmoBrand('newBrand');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.brand).to.equal('newBrand');
        expect(llmoConfig.dataFolder).to.equal('/old/folder'); // Should preserve existing dataFolder
      });

      it('should update brand multiple times', () => {
        config.updateLlmoBrand('firstBrand');
        config.updateLlmoBrand('secondBrand');
        config.updateLlmoBrand('thirdBrand');

        const llmoConfig = config.getLlmoConfig();
        expect(llmoConfig.brand).to.equal('thirdBrand');
      });
    });

    describe('getLlmoHumanQuestions', () => {
      it('should return undefined when llmo questions do not exist', () => {
        expect(config.getLlmoHumanQuestions()).to.be.undefined;
      });

      it('should return Human questions when they exist', () => {
        const questions = {
          Human: [
            { key: 'q1', question: 'What is SEO?' },
            { key: 'q2', question: 'How to improve rankings?' },
          ],
          AI: [
            { key: 'q3', question: 'What is AI?' },
          ],
        };
        config.updateLlmoConfig('/test/folder', 'testBrand', questions);
        expect(config.getLlmoHumanQuestions()).to.deep.equal(questions.Human);
      });
    });

    describe('getLlmoAIQuestions', () => {
      it('should return undefined when llmo questions do not exist', () => {
        expect(config.getLlmoAIQuestions()).to.be.undefined;
      });

      it('should return AI questions when they exist', () => {
        const questions = {
          Human: [
            { key: 'q1', question: 'What is SEO?' },
          ],
          AI: [
            { key: 'q2', question: 'What is AI?' },
            { key: 'q3', question: 'How does ML work?' },
          ],
        };
        config.updateLlmoConfig('/test/folder', 'testBrand', questions);
        expect(config.getLlmoAIQuestions()).to.deep.equal(questions.AI);
      });
    });

    describe('addLlmoHumanQuestions', () => {
      it('should add single question to Human questions', () => {
        const question = { key: 'q1', question: 'What is SEO?' };
        config.addLlmoHumanQuestions([question]);

        const humanQuestions = config.getLlmoHumanQuestions();
        expect(humanQuestions).to.have.length(1);
        expect(humanQuestions[0]).to.deep.equal(question);
      });

      it('should add multiple questions to Human questions', () => {
        const questions = [
          { key: 'q1', question: 'What is SEO?' },
          { key: 'q2', question: 'How to improve rankings?' },
          { key: 'q3', question: 'Best practices for content?' },
        ];
        config.addLlmoHumanQuestions(questions);

        const humanQuestions = config.getLlmoHumanQuestions();
        expect(humanQuestions).to.have.length(3);
        expect(humanQuestions).to.deep.equal(questions);
      });

      it('should append to existing Human questions', () => {
        // First, add some initial questions
        const initialQuestions = [
          { key: 'q1', question: 'What is SEO?' },
        ];
        config.addLlmoHumanQuestions(initialQuestions);

        // Then add more questions
        const additionalQuestions = [
          { key: 'q2', question: 'How to improve rankings?' },
          { key: 'q3', question: 'Best practices for content?' },
        ];
        config.addLlmoHumanQuestions(additionalQuestions);

        const humanQuestions = config.getLlmoHumanQuestions();
        expect(humanQuestions).to.have.length(3);
        expect(humanQuestions[0]).to.deep.equal(initialQuestions[0]);
        expect(humanQuestions[1]).to.deep.equal(additionalQuestions[0]);
        expect(humanQuestions[2]).to.deep.equal(additionalQuestions[1]);
      });

      it('should not affect AI questions when adding Human questions', () => {
        // First add some AI questions
        const aiQuestions = [
          { key: 'ai1', question: 'What is AI?' },
        ];
        config.addLlmoAIQuestions(aiQuestions);

        // Then add Human questions
        const humanQuestions = [
          { key: 'q1', question: 'What is SEO?' },
        ];
        config.addLlmoHumanQuestions(humanQuestions);

        // Verify AI questions are unchanged
        const aiQuestionsResult = config.getLlmoAIQuestions();
        expect(aiQuestionsResult).to.deep.equal(aiQuestions);
      });
    });

    describe('addLlmoAIQuestions', () => {
      it('should add single question to AI questions', () => {
        const question = { key: 'ai1', question: 'What is AI?' };
        config.addLlmoAIQuestions([question]);

        const aiQuestions = config.getLlmoAIQuestions();
        expect(aiQuestions).to.have.length(1);
        expect(aiQuestions[0]).to.deep.equal(question);
      });

      it('should add multiple questions to AI questions', () => {
        const questions = [
          { key: 'ai1', question: 'What is AI?' },
          { key: 'ai2', question: 'How does ML work?' },
          { key: 'ai3', question: 'What is deep learning?' },
        ];
        config.addLlmoAIQuestions(questions);

        const aiQuestions = config.getLlmoAIQuestions();
        expect(aiQuestions).to.have.length(3);
        expect(aiQuestions).to.deep.equal(questions);
      });

      it('should append to existing AI questions', () => {
        // First, add some initial questions
        const initialQuestions = [
          { key: 'ai1', question: 'What is AI?' },
        ];
        config.addLlmoAIQuestions(initialQuestions);

        // Then add more questions
        const additionalQuestions = [
          { key: 'ai2', question: 'How does ML work?' },
          { key: 'ai3', question: 'What is deep learning?' },
        ];
        config.addLlmoAIQuestions(additionalQuestions);

        const aiQuestions = config.getLlmoAIQuestions();
        expect(aiQuestions).to.have.length(3);
        expect(aiQuestions[0]).to.deep.equal(initialQuestions[0]);
        expect(aiQuestions[1]).to.deep.equal(additionalQuestions[0]);
        expect(aiQuestions[2]).to.deep.equal(additionalQuestions[1]);
      });

      it('should not affect Human questions when adding AI questions', () => {
        // First add some Human questions
        const humanQuestions = [
          { key: 'q1', question: 'What is SEO?' },
        ];
        config.addLlmoHumanQuestions(humanQuestions);

        // Then add AI questions
        const aiQuestions = [
          { key: 'ai1', question: 'What is AI?' },
        ];
        config.addLlmoAIQuestions(aiQuestions);

        // Verify Human questions are unchanged
        const humanQuestionsResult = config.getLlmoHumanQuestions();
        expect(humanQuestionsResult).to.deep.equal(humanQuestions);
      });
    });

    describe('removeLlmoQuestion', () => {
      beforeEach(() => {
        // Setup initial questions
        const humanQuestions = [
          { key: 'q1', question: 'What is SEO?' },
          { key: 'q2', question: 'How to improve rankings?' },
        ];
        const aiQuestions = [
          { key: 'ai1', question: 'What is AI?' },
          { key: 'q2', question: 'How to improve rankings?' }, // Same key as Human question
        ];
        config.addLlmoHumanQuestions(humanQuestions);
        config.addLlmoAIQuestions(aiQuestions);
      });

      it('should remove question from both Human and AI arrays by key', () => {
        config.removeLlmoQuestion('q2');

        const humanQuestions = config.getLlmoHumanQuestions();
        const aiQuestions = config.getLlmoAIQuestions();

        expect(humanQuestions).to.have.length(1);
        expect(humanQuestions[0].key).to.equal('q1');
        expect(aiQuestions).to.have.length(1);
        expect(aiQuestions[0].key).to.equal('ai1');
      });

      it('should not remove questions with different keys', () => {
        config.removeLlmoQuestion('nonexistent');

        const humanQuestions = config.getLlmoHumanQuestions();
        const aiQuestions = config.getLlmoAIQuestions();

        expect(humanQuestions).to.have.length(2);
        expect(aiQuestions).to.have.length(2);
      });

      it('should handle removing from empty arrays', () => {
        const emptyConfig = Config();
        expect(() => emptyConfig.removeLlmoQuestion('q1')).to.not.throw();
      });
    });

    describe('updateLlmoQuestion', () => {
      beforeEach(() => {
        // Setup initial questions
        const humanQuestions = [
          { key: 'q1', question: 'What is SEO?', source: 'manual' },
          { key: 'q2', question: 'How to improve rankings?', source: 'ahrefs' },
        ];
        const aiQuestions = [
          { key: 'ai1', question: 'What is AI?', source: 'manual' },
          { key: 'q2', question: 'How to improve rankings?', source: 'ahrefs' }, // Same key as Human question
        ];
        config.addLlmoHumanQuestions(humanQuestions);
        config.addLlmoAIQuestions(aiQuestions);
      });

      it('should update question in both Human and AI arrays by key', () => {
        const update = { question: 'Updated question', source: 'updated-source' };
        config.updateLlmoQuestion('q2', update);

        const humanQuestions = config.getLlmoHumanQuestions();
        const aiQuestions = config.getLlmoAIQuestions();

        // Check Human questions
        const updatedHumanQuestion = humanQuestions.find((q) => q.key === 'q2');
        expect(updatedHumanQuestion.question).to.equal('Updated question');
        expect(updatedHumanQuestion.source).to.equal('updated-source');

        // Check AI questions
        const updatedAIQuestion = aiQuestions.find((q) => q.key === 'q2');
        expect(updatedAIQuestion.question).to.equal('Updated question');
        expect(updatedAIQuestion.source).to.equal('updated-source');
      });

      it('should preserve the key when updating', () => {
        const update = { question: 'Updated question' };
        config.updateLlmoQuestion('q2', update);

        const humanQuestions = config.getLlmoHumanQuestions();
        const aiQuestions = config.getLlmoAIQuestions();

        const updatedHumanQuestion = humanQuestions.find((q) => q.key === 'q2');
        const updatedAIQuestion = aiQuestions.find((q) => q.key === 'q2');

        expect(updatedHumanQuestion.key).to.equal('q2');
        expect(updatedAIQuestion.key).to.equal('q2');
      });

      it('should not update questions with different keys', () => {
        const update = { question: 'Updated question' };
        config.updateLlmoQuestion('nonexistent', update);

        const humanQuestions = config.getLlmoHumanQuestions();
        const aiQuestions = config.getLlmoAIQuestions();

        // Verify no questions were updated
        const humanQuestion = humanQuestions.find((q) => q.key === 'q1');
        const aiQuestion = aiQuestions.find((q) => q.key === 'ai1');

        expect(humanQuestion.question).to.equal('What is SEO?');
        expect(aiQuestion.question).to.equal('What is AI?');
      });

      it('should handle updating in empty arrays', () => {
        const emptyConfig = Config();
        expect(() => emptyConfig.updateLlmoQuestion('q1', { question: 'Updated' })).to.not.throw();
      });

      it('should update only specified fields', () => {
        const update = { question: 'Updated question' };
        config.updateLlmoQuestion('q2', update);

        const humanQuestions = config.getLlmoHumanQuestions();
        const updatedHumanQuestion = humanQuestions.find((q) => q.key === 'q2');

        expect(updatedHumanQuestion.question).to.equal('Updated question');
        expect(updatedHumanQuestion.source).to.equal('ahrefs'); // Should remain unchanged
      });
    });
  });

  describe('LLMO URL Patterns', () => {
    const existingUrlPatterns = [
      { urlPattern: 'https://www.adobe.com/*' },
      { urlPattern: 'https://www.adobe.com/firefly*', tags: ['product: firefly'] },
      { urlPattern: 'https://www.adobe.com/products/firefly*', tags: ['product: firefly'] },
      { urlPattern: 'https://www.adobe.com/fr/*', tags: ['market: fr'] },
      { urlPattern: 'https://www.adobe.com/fr/firefly*', tags: ['product: firefly', 'market: fr'] },
      { urlPattern: 'https://www.adobe.com/fr/products/firefly*', tags: ['product: firefly', 'market: fr'] },
    ];

    let config;

    beforeEach(() => {
      config = Config({
        llmo: {
          dataFolder: '/test/folder',
          brand: 'testBrand',
          urlPatterns: existingUrlPatterns,
        },
      });
    });

    describe('addLlmoUrlPatterns', () => {
      it('Adds additional URL patterns at the end', () => {
        const newPatterns = [
          { urlPattern: 'https://www.adobe.com/acrobat*' },
          { urlPattern: 'https://www.adobe.com/products/acrobat*', tags: ['product: acrobat'] },
        ];
        config.addLlmoUrlPatterns(newPatterns);

        const updatedPatterns = config.getLlmoUrlPatterns();
        expect(updatedPatterns).to.deep.equal([...existingUrlPatterns, ...newPatterns]);
      });

      it('replaces existing URL patterns', () => {
        const existingPattern = {
          urlPattern: 'https://www.adobe.com/firefly*',
          tags: ['completely', 'new', 'tags'],
        };
        const newPattern = {
          urlPattern: 'https://www.adobe.com/ch_fr/firefly*',
          tags: ['product: firefly', 'market: ch'],
        };

        const existingIdx = existingUrlPatterns.findIndex(
          (pattern) => pattern.urlPattern === existingPattern.urlPattern,
        );

        config.addLlmoUrlPatterns([newPattern, existingPattern]);
        const updatedPatterns = config.getLlmoUrlPatterns();

        expect(updatedPatterns).to.deep.equal([
          ...existingUrlPatterns.slice(0, existingIdx),
          existingPattern,
          ...existingUrlPatterns.slice(existingIdx + 1),
          newPattern,
        ]);
      });
    });

    describe('replaceLlmoUrlPatterns', () => {
      it('should replace all existing URL patterns with new ones', () => {
        const newPatterns = [
          { urlPattern: 'https://www.adobe.com/acrobat*' },
          { urlPattern: 'https://www.adobe.com/products/acrobat*', tags: ['product: acrobat'] },
        ];
        config.replaceLlmoUrlPatterns(newPatterns);

        const updatedPatterns = config.getLlmoUrlPatterns();
        expect(updatedPatterns).to.deep.equal(newPatterns);
      });

      it('should clear existing patterns if an empty array is provided', () => {
        config.replaceLlmoUrlPatterns([]);

        const updatedPatterns = config.getLlmoUrlPatterns();
        expect(updatedPatterns).to.deep.equal([]);
      });
    });

    describe('removeLlmoUrlPattern', () => {
      it('can remove an URL pattern from a config', () => {
        const patternToRemove = 'https://www.adobe.com/firefly*';
        const patternIdx = existingUrlPatterns.findIndex(
          (pattern) => pattern.urlPattern === patternToRemove,
        );
        config.removeLlmoUrlPattern(patternToRemove);

        const updatedPatterns = config.getLlmoUrlPatterns();
        expect(updatedPatterns).to.deep.equal([
          ...existingUrlPatterns.slice(0, patternIdx),
          ...existingUrlPatterns.slice(patternIdx + 1),
        ]);
      });

      it('does nothing if the pattern does not exist', () => {
        const nonExistentPattern = 'https://www.adobe.com/nonexistent*';
        config.removeLlmoUrlPattern(nonExistentPattern);

        const updatedPatterns = config.getLlmoUrlPatterns();
        expect(updatedPatterns).to.deep.equal(existingUrlPatterns);
      });
    });
  });

  describe('LLMO Customer Intent Management', () => {
    let config;

    beforeEach(() => {
      config = Config();
    });

    describe('getLlmoCustomerIntent', () => {
      it('should return empty array when llmo config does not exist', () => {
        expect(config.getLlmoCustomerIntent()).to.deep.equal([]);
      });

      it('should return empty array when customerIntent does not exist', () => {
        config.updateLlmoConfig('/test/folder', 'testBrand');
        expect(config.getLlmoCustomerIntent()).to.deep.equal([]);
      });

      it('should return customer intent when it exists', () => {
        const customerIntent = [
          { key: 'target_audience', value: 'small business owners' },
          { key: 'primary_goal', value: 'increase conversions' },
        ];
        config.addLlmoCustomerIntent(customerIntent);
        expect(config.getLlmoCustomerIntent()).to.deep.equal(customerIntent);
      });
    });

    describe('addLlmoCustomerIntent', () => {
      it('should add single customer intent item', () => {
        const intentItem = { key: 'target_audience', value: 'small business owners' };
        config.addLlmoCustomerIntent([intentItem]);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(1);
        expect(customerIntent[0]).to.deep.equal(intentItem);
      });

      it('should add multiple customer intent items', () => {
        const intentItems = [
          { key: 'target_audience', value: 'small business owners' },
          { key: 'primary_goal', value: 'increase conversions' },
          { key: 'user_persona', value: 'marketing director' },
        ];
        config.addLlmoCustomerIntent(intentItems);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(3);
        expect(customerIntent).to.deep.equal(intentItems);
      });

      it('should append to existing customer intent items', () => {
        // First, add some initial items
        const initialItems = [
          { key: 'target_audience', value: 'small business owners' },
        ];
        config.addLlmoCustomerIntent(initialItems);

        // Then add more items
        const additionalItems = [
          { key: 'primary_goal', value: 'increase conversions' },
          { key: 'user_persona', value: 'marketing director' },
        ];
        config.addLlmoCustomerIntent(additionalItems);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(3);
        expect(customerIntent[0]).to.deep.equal(initialItems[0]);
        expect(customerIntent[1]).to.deep.equal(additionalItems[0]);
        expect(customerIntent[2]).to.deep.equal(additionalItems[1]);
      });

      it('should allow duplicate keys', () => {
        const intentItems = [
          { key: 'target_audience', value: 'small business owners' },
          { key: 'target_audience', value: 'enterprise customers' },
        ];
        config.addLlmoCustomerIntent(intentItems);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(2);
        expect(customerIntent[0].key).to.equal('target_audience');
        expect(customerIntent[1].key).to.equal('target_audience');
        expect(customerIntent[0].value).to.equal('small business owners');
        expect(customerIntent[1].value).to.equal('enterprise customers');
      });

      it('should handle empty arrays', () => {
        config.addLlmoCustomerIntent([]);
        expect(config.getLlmoCustomerIntent()).to.deep.equal([]);
      });
    });

    describe('removeLlmoCustomerIntent', () => {
      beforeEach(() => {
        // Setup initial customer intent items
        const intentItems = [
          { key: 'target_audience', value: 'small business owners' },
          { key: 'primary_goal', value: 'increase conversions' },
          { key: 'target_audience', value: 'enterprise customers' }, // Duplicate key
          { key: 'user_persona', value: 'marketing director' },
        ];
        config.addLlmoCustomerIntent(intentItems);
      });

      it('should remove first occurrence of customer intent item by key', () => {
        config.removeLlmoCustomerIntent('target_audience');

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(3);
        expect(customerIntent[0].key).to.equal('primary_goal');
        expect(customerIntent[1].key).to.equal('target_audience');
        expect(customerIntent[1].value).to.equal('enterprise customers');
        expect(customerIntent[2].key).to.equal('user_persona');
      });

      it('should not remove items with different keys', () => {
        config.removeLlmoCustomerIntent('nonexistent');

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(4);
      });

      it('should handle removing from empty arrays', () => {
        const emptyConfig = Config();
        expect(() => emptyConfig.removeLlmoCustomerIntent('target_audience')).to.not.throw();
        expect(emptyConfig.getLlmoCustomerIntent()).to.deep.equal([]);
      });

      it('should handle removing from undefined customerIntent', () => {
        const emptyConfig = Config();
        emptyConfig.updateLlmoConfig('/test/folder', 'testBrand');
        expect(() => emptyConfig.removeLlmoCustomerIntent('target_audience')).to.not.throw();
        expect(emptyConfig.getLlmoCustomerIntent()).to.deep.equal([]);
      });
    });

    describe('updateLlmoCustomerIntent', () => {
      beforeEach(() => {
        // Setup initial customer intent items
        const intentItems = [
          { key: 'target_audience', value: 'small business owners' },
          { key: 'primary_goal', value: 'increase conversions' },
          { key: 'target_audience', value: 'enterprise customers' }, // Duplicate key
          { key: 'user_persona', value: 'marketing director' },
        ];
        config.addLlmoCustomerIntent(intentItems);
      });

      it('should update first occurrence of customer intent item by key', () => {
        const update = { value: 'updated small business owners' };
        config.updateLlmoCustomerIntent('target_audience', update);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(4);
        expect(customerIntent[0].key).to.equal('target_audience');
        expect(customerIntent[0].value).to.equal('updated small business owners');
        expect(customerIntent[2].key).to.equal('target_audience');
        expect(customerIntent[2].value).to.equal('enterprise customers'); // Should remain unchanged
      });

      it('should support partial updates (value only)', () => {
        const update = { value: 'updated goal' };
        config.updateLlmoCustomerIntent('primary_goal', update);

        const customerIntent = config.getLlmoCustomerIntent();
        const updatedItem = customerIntent.find((item) => item.key === 'primary_goal');
        expect(updatedItem.key).to.equal('primary_goal');
        expect(updatedItem.value).to.equal('updated goal');
      });

      it('should support partial updates (key only)', () => {
        const update = { key: 'updated_audience' };
        config.updateLlmoCustomerIntent('target_audience', update);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent[0].key).to.equal('updated_audience');
        expect(customerIntent[0].value).to.equal('small business owners'); // Should remain unchanged
      });

      it('should support updating both key and value', () => {
        const update = { key: 'updated_audience', value: 'updated value' };
        config.updateLlmoCustomerIntent('target_audience', update);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent[0].key).to.equal('updated_audience');
        expect(customerIntent[0].value).to.equal('updated value');
      });

      it('should not update items with different keys', () => {
        const update = { value: 'should not change' };
        config.updateLlmoCustomerIntent('nonexistent', update);

        const customerIntent = config.getLlmoCustomerIntent();
        expect(customerIntent).to.have.length(4);
        // Verify original values are unchanged
        expect(customerIntent[0].value).to.equal('small business owners');
        expect(customerIntent[1].value).to.equal('increase conversions');
      });

      it('should handle updating in empty arrays', () => {
        const emptyConfig = Config();
        expect(() => emptyConfig.updateLlmoCustomerIntent('target_audience', { value: 'updated' })).to.not.throw();
        expect(emptyConfig.getLlmoCustomerIntent()).to.deep.equal([]);
      });

      it('should handle updating in undefined customerIntent', () => {
        const emptyConfig = Config();
        emptyConfig.updateLlmoConfig('/test/folder', 'testBrand');
        expect(() => emptyConfig.updateLlmoCustomerIntent('target_audience', { value: 'updated' })).to.not.throw();
        expect(emptyConfig.getLlmoCustomerIntent()).to.deep.equal([]);
      });
    });

    it('should validate customerIntent data structure in config creation', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
          customerIntent: [
            { key: 'target_audience', value: 'small business owners' },
            { key: 'primary_goal', value: 'increase conversions' },
          ],
        },
      };
      const testConfig = Config(data);
      expect(testConfig.getLlmoCustomerIntent()).to.deep.equal(data.llmo.customerIntent);
    });

    it('should handle empty customerIntent arrays in config creation', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
          customerIntent: [],
        },
      };
      const testConfig = Config(data);
      expect(testConfig.getLlmoCustomerIntent()).to.deep.equal([]);
    });

    it('should handle missing customerIntent in llmo config', () => {
      const data = {
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
        },
      };
      const testConfig = Config(data);
      expect(testConfig.getLlmoCustomerIntent()).to.deep.equal([]);
    });

    it('should preserve customerIntent when updateLlmoConfig is called', () => {
      // First, add some customer intent
      const customerIntent = [
        { key: 'target_audience', value: 'small business owners' },
        { key: 'primary_goal', value: 'increase conversions' },
      ];
      config.addLlmoCustomerIntent(customerIntent);

      // Then update the llmo config with new dataFolder and brand
      config.updateLlmoConfig('/new/folder', 'newBrand');

      // Customer intent should still be there
      expect(config.getLlmoCustomerIntent()).to.deep.equal(customerIntent);

      // And the new values should be set
      expect(config.getLlmoDataFolder()).to.equal('/new/folder');
      expect(config.getLlmoBrand()).to.equal('newBrand');
    });

    it('should preserve customerIntent when updateLlmoConfig is called with questions', () => {
      // First, add some customer intent
      const customerIntent = [
        { key: 'target_audience', value: 'small business owners' },
      ];
      config.addLlmoCustomerIntent(customerIntent);

      // Then update the llmo config with questions
      const questions = {
        Human: [{ key: 'q1', question: 'What is SEO?' }],
      };
      config.updateLlmoConfig('/new/folder', 'newBrand', questions);

      // Customer intent should still be there
      expect(config.getLlmoCustomerIntent()).to.deep.equal(customerIntent);

      // And the new values should be set
      expect(config.getLlmoDataFolder()).to.equal('/new/folder');
      expect(config.getLlmoBrand()).to.equal('newBrand');
      expect(config.getLlmoHumanQuestions()).to.deep.equal(questions.Human);
    });
  });

  describe('LLMO Well Known Tags', () => {
    const { extractWellKnownTags } = Config();

    it('Extracts well known tags from an array of strings', () => {
      const tags = ['arbitrary', 'product: The Product', 'market: The Market', 'another: tag', 'unknown:tag', 'topic: A Topic'];
      expect(extractWellKnownTags(tags)).to.deep.equal({
        product: 'The Product',
        market: 'The Market',
        topic: 'A Topic',
      });
    });

    it('does not require whitespace after the colon', () => {
      const tags = ['product:The Product', 'topic:A Topic'];
      expect(extractWellKnownTags(tags)).to.deep.equal({
        product: 'The Product',
        topic: 'A Topic',
      });
    });
  });
});
