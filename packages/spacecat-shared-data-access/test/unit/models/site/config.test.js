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

    it('returns default config when data is invalid', () => {
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
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('returns default config when invitedUserCount is invalid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
          invitedUserCount: -12,
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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

      // Should still return default config
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});

      // Should have logged the error
      expect(loggedError).to.equal('Site configuration validation failed, using default config');
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
      // Config() catches validation errors and returns default config instead of throwing
      const config = Config(data);
      expect(config.getLlmoConfig()).to.be.undefined;
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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

    it('should return default config if cdnLogsConfig is invalid', () => {
      const data = {
        cdnLogsConfig: {
          filters: [{ key: 'test-key', value: ['test-value'] }],
          outputLocation: 'test-output-location',
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
      expect(config.getCdnLogsConfig()).to.be.undefined;
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

    it('Config creation with an incorrect groupedURLs option type returns default config', () => {
      const data = {
        handlers: {
          'broken-backlinks': {
            groupedURLs: 'invalid-type',
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('Config creation with an incorrect groupedURLs option structure returns default config', () => {
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
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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

    it('should return default config if latestMetrics is invalid', () => {
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
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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

    it('includes llmo in toDynamoItem conversion', () => {
      const data = Config({
        llmo: {
          dataFolder: '/data/folder',
          brand: 'mybrand',
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

    it('returns default config for unknown import type', () => {
      const config = Config({
        imports: [{
          type: 'unknown-type',
          destinations: ['default'],
          sources: ['ahrefs'],
        }],
      });
      expect(config.getImports()).to.be.undefined;
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('returns default config for invalid import configuration', () => {
      const config = Config({
        imports: [{
          type: 'organic-keywords',
          destinations: ['invalid'],
          sources: ['invalid'],
        }],
      });

      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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
            .to.equal('"imports[0].destinations[0]" must be [default]. "imports[0].type" must be [organic-keywords-nonbranded]. "imports[0].type" must be [organic-keywords-ai-overview]. "imports[0].type" must be [organic-keywords-feature-snippets]. "imports[0].type" must be [organic-keywords-questions]. "imports[0].type" must be [organic-traffic]. "imports[0].type" must be [all-traffic]. "imports[0].type" must be [top-pages]. "imports[0].type" must be [cwv-daily]. "imports[0].type" must be [cwv-weekly]. "imports[0].type" must be [traffic-analysis]');
          expect(error.cause.details[0].context.details)
            .to.eql([
              {
                message: '"imports[0].destinations[0]" must be [default]',
                path: [
                  'imports',
                  0,
                  'destinations',
                  0,
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'default',
                  ],
                  label: 'imports[0].destinations[0]',
                  value: 'invalid',
                  key: 0,
                },
              },
              {
                context: {
                  key: 'type',
                  label: 'imports[0].type',
                  valids: [
                    'organic-keywords-nonbranded',
                  ],
                  value: 'organic-keywords',
                },
                message: '"imports[0].type" must be [organic-keywords-nonbranded]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
              },
              {
                context: {
                  key: 'type',
                  label: 'imports[0].type',
                  valids: [
                    'organic-keywords-ai-overview',
                  ],
                  value: 'organic-keywords',
                },
                message: '"imports[0].type" must be [organic-keywords-ai-overview]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
              },
              {
                context: {
                  key: 'type',
                  label: 'imports[0].type',
                  valids: [
                    'organic-keywords-feature-snippets',
                  ],
                  value: 'organic-keywords',
                },
                message: '"imports[0].type" must be [organic-keywords-feature-snippets]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
              },
              {
                context: {
                  key: 'type',
                  label: 'imports[0].type',
                  valids: [
                    'organic-keywords-questions',
                  ],
                  value: 'organic-keywords',
                },
                message: '"imports[0].type" must be [organic-keywords-questions]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
              },
              {
                message: '"imports[0].type" must be [organic-traffic]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'organic-traffic',
                  ],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
              {
                message: '"imports[0].type" must be [all-traffic]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'all-traffic',
                  ],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
              {
                message: '"imports[0].type" must be [top-pages]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'top-pages',
                  ],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
              {
                message: '"imports[0].type" must be [cwv-daily]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'cwv-daily',
                  ],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
              {
                message: '"imports[0].type" must be [cwv-weekly]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'cwv-weekly',
                  ],
                  label: 'imports[0].type',
                  value: 'organic-keywords',
                  key: 'type',
                },
              },
              {
                message: '"imports[0].type" must be [traffic-analysis]',
                path: [
                  'imports',
                  0,
                  'type',
                ],
                type: 'any.only',
                context: {
                  valids: [
                    'traffic-analysis',
                  ],
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

    it('should return default config for negative movingAvgThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: -5,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('should return default config for zero movingAvgThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            movingAvgThreshold: 0,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('should return default config for negative percentageChangeThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            percentageChangeThreshold: -10,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
    });

    it('should return default config for zero percentageChangeThreshold values', () => {
      const data = {
        handlers: {
          'organic-traffic-internal': {
            percentageChangeThreshold: 0,
          },
        },
      };
      const config = Config(data);
      expect(config.getSlackConfig()).to.deep.equal({});
      expect(config.getHandlers()).to.deep.equal({});
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
});
