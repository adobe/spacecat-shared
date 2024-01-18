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
      expect(config.slack).to.be.empty;
      expect(config.alerts).to.deep.equal([]);
    });

    it('creates an Config with provided data when data is valid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        alerts: [{
          type: '404',
          mentions: [{ slack: ['id1'] }],
          byOrg: true,
        }],
      };
      const config = Config(data);
      expect(config.slack.channel).to.equal('channel1');
      expect(config.slack.workspace).to.equal('workspace1');
      expect(config.alerts[0].mentions[0].slack[0]).to.equal('id1');
      expect(config.alerts[0].byOrg).to.be.true;
    });

    it('throws an error when data is invalid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        alerts: [{
          type: 404,
          mentions: [{ email: ['id1'] }],
          byOrg: true,
        }],
      };
      expect(() => Config(data)).to.throw('Configuration validation error: "alerts[0].type" must be a string');
    });
  });

  describe('fromDynamoItem Static Method', () => {
    it('correctly converts from DynamoDB item', () => {
      const dynamoItem = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        alerts: [{
          type: '404',
          mentions: [{ slack: ['id1'] }],
          byOrg: true,
        }],
      };
      const config = Config.fromDynamoItem(dynamoItem);
      expect(config.slack.channel).to.equal('channel1');
      expect(config.slack.workspace).to.equal('workspace1');
      expect(config.alerts[0].mentions[0].slack[0]).to.equal('id1');
      expect(config.alerts[0].byOrg).to.be.true;
    });
  });

  describe('toDynamoItem Static Method', () => {
    it('correctly converts to DynamoDB item format', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        alerts: [{
          type: '404',
          mentions: [{ slack: ['id1'] }],
          byOrg: true,
        }],
      };
      const dynamoItem = Config.toDynamoItem(data);
      expect(dynamoItem.slack.channel).to.equal('channel1');
      expect(dynamoItem.slack.workspace).to.equal('workspace1');
      expect(dynamoItem.alerts[0].mentions[0].slack[0]).to.equal('id1');
      expect(dynamoItem.alerts[0].byOrg).to.be.true;
    });

    it('thorws error when item is invalid', () => {
      const data = {
        slack: {
          channel: 'channel1',
          workspace: 'workspace1',
        },
        alerts: [{
          type: 404,
          mentions: [{ email: ['id1'] }],
          byOrg: true,
        }],
      };
      expect(() => Config.toDynamoItem(data)).to.throw('Configuration validation error: "alerts[0].type" must be a string');
    });
  });
});
