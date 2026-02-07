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

import ElevatedSlackClient from '../../src/clients/elevated-slack-client.js';
import { BaseSlackClient, SLACK_TARGETS } from '../../src/index.js';

use(chaiAsPromised);

describe('ElevatedSlackClient', () => {
  const mockToken = 'mock-token';
  const mockOpsConfig = {
    opsChannelId: 'ops123',
    admins: ['admin1', 'admin2'],
  };
  let mockLog;

  let client;
  let mockApi;

  beforeEach(() => {
    mockLog = {
      info: sinon.spy(),
      error: sinon.spy(),
      warn: sinon.spy(),
      debug: sinon.spy(),
    };

    client = new ElevatedSlackClient(mockToken, mockOpsConfig, mockLog);
    mockApi = nock('https://slack.com/api');
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
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
      const slackClient = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(slackClient).to.be.instanceOf(BaseSlackClient);
    });

    it('creates a client if context.slackClients is undefined', () => {
      delete context.slackClients;
      const slackClient = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(slackClient).to.be.instanceOf(BaseSlackClient);
    });

    it('throws an error if target is missing', () => {
      expect(() => ElevatedSlackClient.createFrom(context, '')).to.throw('Missing target for the Slack Client');
    });

    it('throws an error if Slack token is not set', () => {
      context.env = {};
      expect(() => ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL)).to.throw('No Slack token set for WORKSPACE_INTERNAL');
    });

    it('throws an error if Ops Channel ID is not set', () => {
      context.env.SLACK_OPS_CHANNEL_WORKSPACE_INTERNAL = '';
      context.env.SLACK_OPS_ADMINS_WORKSPACE_INTERNAL = undefined;
      expect(() => ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL)).to.throw('No Ops Channel ID set for WORKSPACE_INTERNAL');
    });

    it('reuses existing client instances for the same target', () => {
      const client1 = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      const client2 = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      expect(client1).to.equal(client2);
    });

    it('does not reuse client instances for different targets', () => {
      const client1 = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_INTERNAL);
      const client2 = ElevatedSlackClient.createFrom(context, SLACK_TARGETS.WORKSPACE_EXTERNAL);
      expect(client1).to.not.equal(client2);
    });
  });

  describe('general', () => {
    it('throws error if getting self fails', async () => {
      mockApi.post('/auth.test').reply(200, { ok: false, error: 'some_error' });

      await expect(client.createChannel('new-channel', false)).to.eventually.be.rejectedWith(Error);
      expect(mockLog.error.calledWith('Failed to retrieve self information')).to.be.true;
    });

    it('throws error if getting team info fails', async () => {
      mockApi.post('/auth.test').reply(200, { ok: true, user_id: 'U123456' });
      mockApi.post('/team.info').reply(200, { ok: false, error: 'some_error' });

      await expect(client.createChannel('new-channel', false)).to.eventually.be.rejectedWith(Error);
      expect(mockLog.error.calledWith('Failed to retrieve team information')).to.be.true;
    });

    it('logs error if posting to ops channel fails', async () => {
      mockApi.post('/auth.test').reply(200, { ok: true, user_id: 'U123456' });
      mockApi.post('/team.info').reply(200, { ok: true, team: { id: 'T123456', name: 'test-team' } });
      mockApi.post('/conversations.create').reply(200, {
        ok: true,
        channel: { id: 'C123456', name: 'new-channel' },
      });
      mockApi.post('/conversations.invite').reply(200, {
        ok: true,
      });
      mockApi.post('/conversations.invite').reply(200, {
        ok: true,
      });
      mockApi.post('/chat.postMessage').reply(200, {
        ok: false,
        error: 'some_error',
      });

      await client.createChannel('new-channel', false);
      expect(mockLog.error.calledWithMatch('Failed to post message to ops channel')).to.be.true;
    });
  });

  describe('Functional', () => {
    beforeEach(() => {
      mockApi.post('/auth.test').reply(200, { ok: true, user_id: 'U123456' });
      mockApi.post('/team.info').reply(200, { ok: true, team: { id: 'T123456', name: 'test-team' } });
      mockApi.post('/chat.postMessage').reply(200, { ok: true, channel: 'C123456', ts: '1234567890.12345' });
    });

    describe('createChannel', () => {
      it('creates a public channel successfully', async () => {
        mockApi.post('/conversations.create').reply(200, {
          ok: true,
          channel: { id: 'C123456', name: 'new-channel' },
        });

        mockApi.post('/conversations.setTopic').reply(200, { ok: true });
        mockApi.post('/conversations.setPurpose').reply(200, { ok: true });

        // ops admin 1 invited to the channel
        mockApi.post('/conversations.invite').reply(200, {
          ok: true,
        });
        // ops admin 1 invited to the channel
        mockApi.post('/conversations.invite').reply(200, {
          ok: true,
        });

        const channel = await client.createChannel('new-channel', 'topic', 'description', false);
        expect(channel).to.have.property('id', 'C123456');
        expect(channel).to.have.property('name', 'new-channel');
        expect(mockLog.info.calledWith('Created channel C123456 with name new-channel in workspace T123456')).to.be.true;
      });

      it('throws an error if channel name is missing', async () => {
        await expect(client.createChannel()).to.eventually.be.rejectedWith(Error, 'Channel name is required');
      });

      it('throws an error if the channel name is taken', async () => {
        mockApi.post('/conversations.create').reply(200, { ok: false, error: 'name_taken' });

        await expect(client.createChannel('existing-channel', false)).to.eventually.be.rejectedWith(Error);
        expect(mockLog.warn.calledWith('Channel with name existing-channel already exists')).to.be.true;
      });

      it('throws an error if the channel creation fails', async () => {
        mockApi.post('/conversations.create').reply(200, { ok: false, error: 'some_error' });

        await expect(client.createChannel('some-channel', false)).to.eventually.be.rejectedWith(Error);
        expect(mockLog.error.calledWithMatch('Failed to create channel some-channel')).to.be.true;
      });

      it('does not initialize more than once', async () => {
        mockApi.post('/conversations.create').reply(200, { ok: false, error: 'some_error' });
        mockApi.post('/conversations.create').reply(200, { ok: false, error: 'some_error' });

        await expect(client.createChannel('some-channel', false)).to.eventually.be.rejectedWith(Error);
        await expect(client.createChannel('some-channel', false)).to.eventually.be.rejectedWith(Error);

        expect(mockLog.info.callCount).to.equal(3);
        expect(mockLog.info.firstCall.calledWithMatch('API call auth.test')).to.be.true;
        expect(mockLog.info.secondCall.calledWithMatch('API call team.info')).to.be.true;
        expect(mockLog.info.thirdCall.calledWithMatch('Slack client initialized')).to.be.true;
      });

      it('logs errors if adding admins to new channel fails', async () => {
        mockApi.post('/conversations.create').reply(200, {
          ok: true,
          channel: { id: 'C123456', name: 'new-channel' },
        });
        mockApi.post('/conversations.invite').reply(200, {
          ok: false,
          error: 'some_error',
        });
        mockApi.post('/conversations.invite').reply(200, {
          ok: false,
          error: 'some_error',
        });

        await client.createChannel('new-channel', false);
        expect(mockLog.error.calledWithMatch('Failed to invite admin to channel')).to.be.true;
      });
    });

    describe('inviteUsersByEmail', () => {
      it('invites a user to a channel', async () => {
        mockApi.post('/users.lookupByEmail').reply(200, { ok: true, user: { id: 'U123456', profile: {} } });
        mockApi.post('/users.conversations').reply(200, { ok: true, channels: [{ id: 'C823823' }] });
        mockApi.post('/conversations.invite').reply(200, { ok: true });

        const results = await client.inviteUsersByEmail('C123456', [{ email: 'test@example.com' }]);
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0]).to.deep.equal({ email: 'test@example.com', status: 'user_invited_to_channel' });
      });

      it('handles user not found error', async () => {
        // Remove existing API mocks so we can assert on the params passed to postMessage
        let verifiedOpsMessage = false;
        nock.cleanAll();
        mockApi.post('/auth.test').reply(200, { ok: true, user_id: 'U123456' });
        mockApi.post('/team.info').reply(200, { ok: true, team: { id: 'T123456', name: 'test-team' } });
        mockApi.post('/chat.postMessage', (body) => {
          // Verify that the email addresses are ordered by domain
          expect(body.text).to.equal('The following users need to be invited to the workspace: '
            + 'b@different.example.com\n'
            + 'a@domain1.example.com\n'
            + 'c@domain1.example.com');
          verifiedOpsMessage = true;
          return true;
        })
          .reply(200, { ok: true, channel: 'C123456', ts: '1234567890.12345' });
        mockApi.post('/users.lookupByEmail').thrice().reply(200, { ok: false, error: 'users_not_found' });

        const results = await client.inviteUsersByEmail('C123456', [
          { email: 'a@domain1.example.com' },
          { email: 'b@different.example.com' },
          { email: 'c@domain1.example.com' },
        ]);
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0]).to.deep.equal({ email: 'a@domain1.example.com', status: 'user_needs_invitation_to_workspace' });

        expect(verifiedOpsMessage).to.be.true;
      });

      it('throws error when channel id is missing', async () => {
        await expect(client.inviteUsersByEmail()).to.eventually.be.rejectedWith(Error, 'Channel ID is required');
      });

      it('throws error when users are missing', async () => {
        await expect(client.inviteUsersByEmail('some-channel')).to.eventually.be.rejectedWith(Error, 'Users must be an array');
      });

      it('throws error without at least one valid user', async () => {
        await expect(client.inviteUsersByEmail('some-channel', [])).to.eventually.be.rejectedWith(Error, 'At least one valid user is required');
        await expect(client.inviteUsersByEmail('some-channel', [{ email: '' }])).to.eventually.be.rejectedWith(Error, 'At least one valid user is required');
      });

      it('sets users status to general error if lookup by email fails', async () => {
        mockApi.post('/users.lookupByEmail').reply(200, { ok: false, error: 'some_error' });

        const results = await client.inviteUsersByEmail('C123456', [{ email: 'some-user@example.com' }]);

        expect(results).to.be.an('array').with.length(1);
        expect(results[0].status).to.equal('general_error');
      });

      it('throws error if user channels lookup fails', async () => {
        mockApi.post('/users.lookupByEmail').reply(200, { ok: true, user: { id: 'U123456' } });
        mockApi.post('/users.conversations').reply(200, { ok: false, error: 'some_error' });

        const results = await client.inviteUsersByEmail('C123456', [{ email: 'test@example.com' }]);
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0].status).to.equal('general_error');
      });

      it('sets user status if user already in same channel', async () => {
        mockApi.post('/users.lookupByEmail').reply(200, { ok: true, user: { id: 'U123456' } });
        mockApi.post('/users.conversations').reply(200, { ok: true, channels: [{ id: 'C123456' }] });

        const results = await client.inviteUsersByEmail('C123456', [{ email: 'test@example.com' }]);
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0]).to.deep.equal({ email: 'test@example.com', status: 'user_already_in_channel' });
      });

      it('sets user status if user needs upgrade from single-channel to multichannel guest', async () => {
        mockApi.post('/users.lookupByEmail').reply(200, {
          ok: true,
          user: {
            id: 'U123456',
            is_ultra_restricted: true,
            is_restricted: true,
          },
        });
        mockApi.post('/users.conversations').reply(200, { ok: true, channels: [{ id: 'C239848397' }] });

        const results = await client.inviteUsersByEmail('C123456', [{ email: 'test@example.com' }]);
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0]).to.deep.equal({ email: 'test@example.com', status: 'user_already_in_another_channel' });
      });
    });
  });
});
