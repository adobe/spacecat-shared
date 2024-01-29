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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import nock from 'nock';

import BaseSlackClient from '../../src/clients/base-slack-client.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('BaseSlackClient', () => {
  const mockToken = 'mock-token';
  const mockLog = { error: sinon.spy() };
  let client;
  let nockScope;

  before(() => {
    client = new BaseSlackClient(mockToken, mockLog);
    nockScope = nock('https://slack.com');
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  describe('postMessage', () => {
    const message = { channel: 'C123456', text: 'Hello world' };
    const response = { ok: true, channel: 'C123456', ts: '1234567890.12345' };

    it('sends a message successfully', async () => {
      nockScope.post('/api/chat.postMessage').reply(200, response);

      const result = await client.postMessage(message);
      expect(result).to.deep.equal({ channelId: response.channel, threadId: response.ts });
    });

    it('throws an error on Slack API failure', () => {
      nockScope.post('/api/chat.postMessage').reply(500);

      expect(client.postMessage(message)).to.eventually.be.rejectedWith(Error);
    });

    it('logs an error on Slack API failure', async () => {
      nockScope.post('/api/chat.postMessage').reply(200, { ok: false });

      try {
        await client.postMessage(message);
      } catch (e) {
        expect(mockLog.error.called).to.be.true;
      }
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
      nockScope.post('/api/files.uploadV2').reply(200, { ok: true, files: [] });

      expect(client.fileUpload(file)).to.eventually.be.rejectedWith(Error);
    });

    it('throws an error on Slack API failure', () => {
      client.client = webApiClient;
      nockScope.post('/api/files.uploadV2').reply(500);

      expect(client.fileUpload(file)).to.eventually.be.rejectedWith(Error);
    });

    it('logs an error on Slack API failure', async () => {
      client.client = webApiClient;
      nockScope.post('/api/files.uploadV2').reply(500);

      try {
        await client.fileUpload(file);
      } catch (e) {
        expect(mockLog.error.called).to.be.true;
      }
    });
  });

  after(() => {
    nock.restore();
  });
});
