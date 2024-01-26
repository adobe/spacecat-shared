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
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import { Message, Blocks, Elements } from 'slack-block-builder';
import { SlackClient, SLACK_TARGETS } from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Slack Client', () => {
  let context;
  const text = 'some-text';
  const blocks = [{ type: 'section', text: { type: 'plain_text', text: 'Hello world' } }];

  it('does not create a new instance if previously initialized', async () => {
    const target = 'corp-internal';
    context = {
      log: console,
      slackClients: {
        [target]: 'hebele',
      },
    };
    const slackClient = SlackClient.createFrom(context, target);
    expect(slackClient).to.equal('hebele');
  });

  it('does not create a new instance without a proper env variables', async () => {
    context = { log: console, env: {} };
    expect(() => SlackClient.createFrom(context, 'unknown-target'))
      .to.throw('No slack token set for unknown-target');
  });

  it('does not create a new instance without a target', async () => {
    context = { log: console, env: {} };
    expect(() => SlackClient.createFrom(context))
      .to.throw('Missing target for the Slack Client');
  });

  it('creates a new instance if previously not initialized', async () => {
    context = {
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };
    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL);
    expect(slackClient).to.be.a('object');
    expect(SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL)).to.equal(slackClient);
  });

  it('returns channel-id and thread-id when message posted', async () => {
    context = {
      log: console,
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };

    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

    nock('https://slack.com', {
      reqheaders: {
        authorization: `Bearer ${context.env.SLACK_TOKEN_ADOBE_INTERNAL}`,
      },
    })
      .post('/api/chat.postMessage', {
        channel: 'channel-id',
        blocks: JSON.stringify(blocks),
        text,
        thread_ts: 'thread-id',
      })
      .reply(200, '{ "ok": true, "channel": "channel-id", "ts": "thread-id" }');

    const resp = await slackClient.postMessage({
      channel: 'channel-id',
      blocks,
      text,
      thread_ts: 'thread-id',
    });
    expect(resp.channelId).to.equal('channel-id');
    expect(resp.threadId).to.equal('thread-id');
  });

  it('returns an error message when api returns unsuccessful', async () => {
    context = {
      log: console,
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };

    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);
    nock('https://slack.com', {
      reqheaders: {
        authorization: `Bearer ${context.env.SLACK_TOKEN_ADOBE_INTERNAL}`,
      },
    })
      .post('/api/chat.postMessage', {
        channel: 'channel-id',
        blocks: JSON.stringify(blocks),
        text,
        thread_ts: 'thread-id',
      })
      .reply(200, '{ "ok": false, "error": "meh" }');

    await expect(slackClient.postMessage({
      channel: 'channel-id',
      blocks,
      text,
      thread_ts: 'thread-id',
    })).to.be.rejectedWith('An API error occurred: meh');
  });

  it('test using slack block builder', async () => {
    context = {
      log: console,
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };

    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

    const channel = 'channel-id';
    const thread = 'thread-id';

    const message = Message()
      .channel(channel)
      .threadTs(thread)
      .text('Alas, my friend.')
      .blocks(
        Blocks.Section()
          .text('One does not simply walk into Slack and click a button.'),
        Blocks.Section()
          .text('At least that\'s what my friend Slackomir said :crossed_swords:'),
        Blocks.Divider(),
        Blocks.Actions()
          .elements(
            Elements.Button()
              .text('Sure One Does')
              .actionId('gotClicked')
              .danger(true), // Optional argument, defaults to 'true'
            Elements.Button()
              .text('One Does Not')
              .actionId('scaredyCat')
              .primary(),
          ),
      )
      .buildToObject();

    nock('https://slack.com', {
      reqheaders: {
        authorization: `Bearer ${context.env.SLACK_TOKEN_ADOBE_INTERNAL}`,
      },
    })
      .post('/api/chat.postMessage', {
        ...message,
        blocks: JSON.stringify(message.blocks),
      })
      .reply(200, '{ "ok": true, "channel": "channel-id", "ts": "thread-id" }');

    const resp = await slackClient.postMessage(message);
    expect(resp.channelId).to.equal('channel-id');
    expect(resp.threadId).to.equal('thread-id');
  });

  it('returns file url and channels when file is uploaded', async () => {
    context = {
      log: console,
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };

    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

    slackClient.client = {
      apiCall: sinon.stub().resolves({
        files: [{ id: 'F06FKAFEL05', url_private: '//big-picture.jpeg', channels: ['channel-id'] }],
      }),
    };

    const resp = await slackClient.fileUpload({
      file: Buffer.from('hebele', 'utf8'),
      channels: 'channel-id',
      initial_comment: 'here is your file',
      filename: 'big-picture.jpeg',
      thread_ts: 'thread-id',
    });
    expect(resp.channels).to.eql(['channel-id']);
    expect(resp.fileUrl).to.equal('//big-picture.jpeg');

    sinon.restore();
  });

  it('throws error when file upload fails', async () => {
    context = {
      log: console,
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token0internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    };

    const slackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

    slackClient.client = {
      apiCall: sinon.stub().resolves({ files: [] }),
    };

    const message = {
      file: Buffer.from('hebele', 'utf8'),
      channels: 'channel-id',
      initial_comment: 'here is your file',
      filename: 'big-picture.jpeg',
      thread_ts: 'thread-id',
    };

    await expect(slackClient.fileUpload(message))
      .to.be.rejectedWith('File upload was unsuccessful. Filename was "big-picture.jpeg"');

    sinon.restore();
  });
});
