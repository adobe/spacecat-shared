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

import { Config } from '../../../../src/models/site/config.js';

describe('Config Tests', () => {
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

    it('throws an error when data is invalid', () => {
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
      expect(() => Config(data)).to.throw('Configuration validation error: "handlers.404.mentions" must be of type object');
    });

    it('throws an error when invitedUserCount is invalid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
          invitedUserCount: -12,
        },
      };
      expect(() => Config(data)).to.throw('Configuration validation error: "slack.invitedUserCount" must be greater than or equal to 0');
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

    it('correctly updates the Slack mentions', () => {
      const config = Config();
      config.updateSlackMentions('404', ['id1', 'id2']);

      const slackMentions = config.getSlackMentions('404');
      expect(slackMentions).to.deep.equal(['id1', 'id2']);
    });

    it('correctly updates the excluded URLs', () => {
      const config = Config();
      config.updateExcludeURLs('404', ['url1', 'url2']);

      const excludedURLs = config.getExcludedURLs('404');
      expect(excludedURLs).to.deep.equal(['url1', 'url2']);
    });

    it('correctly updates the manual overrides', () => {
      const config = Config();
      const manualOverrides = [
        { brokenTargetURL: 'url1', targetURL: 'url2' },
        { brokenTargetURL: 'url3', targetURL: 'url4' },
      ];
      config.updateManualOverrides('broken-backlinks', manualOverrides);

      const updatedManualOverrides = config.getManualOverrides('broken-backlinks');
      expect(updatedManualOverrides).to.deep.equal(manualOverrides);
    });
  });

  describe('fromDynamoItem Static Method', () => {
    it('correctly converts from DynamoDB item', () => {
      const dynamoItem = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
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
      expect(slackConfig.channel).to.equal('channel1');
      expect(slackConfig.workspace).to.equal('workspace1');
      expect(slackMentions[0]).to.equal('id1');
    });
  });

  describe('toDynamoItem Static Method', () => {
    it('correctly converts to DynamoDB item format', () => {
      const data = Config({
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
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
      expect(slackConfig.workspace).to.equal('workspace1');
      expect(slackMentions[0]).to.equal('id1');
    });
  });
});
