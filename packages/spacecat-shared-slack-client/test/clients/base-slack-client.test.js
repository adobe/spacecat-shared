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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';

import { BaseSlackClient, SLACK_TARGETS } from '../../src/index.js';

use(chaiAsPromised);

describe('BaseSlackClient', () => {
  const mockToken = 'mock-token';
  const mockOpsConfig = {
    opsChannelId: 'ops123',
    admins: ['admin1', 'admin2'],
  };
  const mockLog = {
    debug: sinon.spy(),
    error: sinon.spy(),
  };
  let client;
  let mockApi;

  beforeEach(() => {
    client = new BaseSlackClient(mockToken, mockOpsConfig, mockLog);
    mockApi = nock('https://slack.com');
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  describe('creation', () => {
    let context;

    beforeEach(() => {
      context = {
        env: {
          SLACK_TOKEN_WORKSPACE_INTERNAL: mockToken,
          SLACK_TOKEN_WORKSPACE_EXTERNAL: mockToken,
          SLACK_TOKEN_WORKSPACE_INTERNAL_ELEVATED: mockToken,
          SLACK_TOKEN_WORKSPACE_EXTERNAL_ELEVATED: mockToken,
          SLACK_OPS_CHANNEL_WORKSPACE_INTERNAL: 'mock-channel',
          SLACK_OPS_CHANNEL_WORKSPACE_EXTERNAL: 'mock-channel',
          SLACK_OPS_ADMINS_WORKSPACE_INTERNAL: 'mock-admin',
          SLACK_OPS_ADMINS_WORKSPACE_EXTERNAL: 'mock-admin',
        },
        slackClients: {},
        log: mockLog,
      };
    });

    it('creates a BaseSlackClient for non-elevated targets', () => {
      const slackClient = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(slackClient).to.be.instanceOf(BaseSlackClient);
    });

    it('creates a client if context.slackClients is undefined', () => {
      delete context.slackClients;
      const slackClient = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(slackClient).to.be.instanceOf(BaseSlackClient);
    });

    it('throws an error if target is missing', () => {
      expect(() => BaseSlackClient.createFrom(context, '')).to.throw('Missing target for the Slack Client');
    });

    it('throws an error if Slack token is not set', () => {
      context.env = {};
      expect(() => BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL)).to.throw('No Slack token set for WORKSPACE_INTERNAL');
    });

    it('throws an error if Ops Channel ID is not set', () => {
      context.env.SLACK_OPS_CHANNEL_WORKSPACE_INTERNAL = '';
      context.env.SLACK_OPS_ADMINS_WORKSPACE_INTERNAL = undefined;
      expect(() => BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL)).to.throw('No Ops Channel ID set for WORKSPACE_INTERNAL');
    });

    it('reuses existing client instances for the same target', () => {
      const client1 = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      const client2 = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(client1).to.equal(client2);
    });

    it('does not reuse client instances for different targets', () => {
      const client1 = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      const client2 = BaseSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_EXTERNAL);
      expect(client1).to.not.equal(client2);
    });
  });

  describe('postMessage', () => {
    const message = { channel: 'C123456', text: 'Hello world' };
    const response = { ok: true, channel: 'C123456', ts: '1234567890.12345' };

    it('sends a message successfully', async () => {
      mockApi.post('/api/chat.postMessage').reply(200, response);

      const result = await client.postMessage(message);
      expect(result).to.deep.equal({ channelId: response.channel, threadId: response.ts });
    });

    it('throws an error on Slack API failure', () => {
      mockApi.post('/api/chat.postMessage').reply(500);

      expect(client.postMessage(message)).to.eventually.be.rejectedWith(Error);
    });
  });

  describe('fileUpload', () => {
    const file = {
      file: Buffer.from('hebele', 'utf8'),
      channel_id: 'C123456',
      initial_comment: 'here is your file',
      filename: 'big-picture.jpeg',
      thread_ts: 'thread-id',
    };

    const webApiClient = {
      apiCall: sinon.stub().resolves({
        ok: true, // for the team.info call
        team: { id: 'team-id' }, // for the team.info call
        files: [{ id: 'F06FKAFEL05', url_private: '//big-picture.jpeg', channels: ['channel-id'] }],
      }),
    };

    it('uploads a file successfully', async () => {
      client.client = webApiClient;

      const resp = await client.fileUpload(file);
      expect(resp.channels).to.eql(['channel-id']);
      expect(resp.fileUrl).to.equal('//big-picture.jpeg');
    });

    it('throws an error on unsuccessful file upload', () => {
      client.client = {
        apiCall: sinon.stub().resolves({
          ok: true,
          team: { id: 'team-id' },
          files: [],
        }),
      };
      mockApi.post('/api/files.uploadV2').reply(200, { ok: true, files: [] });

      expect(client.fileUpload(file)).to.eventually.be.rejectedWith(Error);
    });

    it('throws an error on Slack API failure', () => {
      client.client = webApiClient;
      mockApi.post('/api/files.uploadV2').reply(500);

      expect(client.fileUpload(file)).to.eventually.be.rejectedWith(Error);
    });

    it('logs an error on Slack API failure', async () => {
      const errorStub = sinon.stub().rejects(new Error('API call failed'));
      client.client = {
        apiCall: errorStub,
      };

      try {
        await client.fileUpload(file);
      } catch {
        expect(mockLog.error.called).to.be.true;
      }
    });
  });
});
