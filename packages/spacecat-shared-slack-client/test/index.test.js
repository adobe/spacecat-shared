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
import nock from 'nock';
import { Message, Blocks, Elements } from 'slack-block-builder';
import { SlackClient } from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Slack Client', () => {
  const context = {
    log: console,
    env: {
      SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
      SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
    },
  };
  const text = 'some-text';
  const blocks = [{ type: 'section', text: { type: 'plain_text', text: 'Hello world' } }];

  it('does not create a new instance if previously initialized', async () => {
    const slackClient = SlackClient.createFrom({ slackClient: 'hebele', env: {} });
    expect(slackClient).to.equal('hebele');
  });

  it('does not create a new instance without proper params', async () => {
    expect(() => new SlackClient('asd'))
      .to.throw('targetTokenPairs parameter should be an array');
  });

  it('does not create a new instance without a proper env variables', async () => {
    expect(() => SlackClient.createFrom({ env: {} }))
      .to.throw('No environment variable containing a slack token found');
  });

  it('creates a new instance if previously not initialized', async () => {
    const slackClient = SlackClient.createFrom({
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
        SLACK_TOKEN_ADOBE_EXTERNAL: 'token-external',
      },
    });
    expect(Object.keys(slackClient.clients).length).to.equal(2);
  });

  it('returns an error for an unknown target', async () => {
    const slackClient = SlackClient.createFrom({
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: 'token-internal',
      },
    });
    await expect(slackClient.postMessage('unknown-target', {}))
      .to.be.rejectedWith('Environment variable \'SLACK_TOKEN_unknown-target\' does not exist. Slack Client could not initialized.');
  });

  it('returns channel-id and thread-id when message posted', async () => {
    const slackClient = SlackClient.createFrom(context);

    nock('https://slack.com', {
      reqheaders: {
        authorization: `Bearer ${context.env.SLACK_TOKEN_ADOBE_INTERNAL}`,
      },
    })
      .post('/api/chat.postMessage', {
        unfurl_links: false,
        unfurl_media: false,
        channel: 'channel-id',
        blocks: JSON.stringify(blocks),
        text,
        ts: 'thread-id',
      })
      .reply(200, '{ "ok": true, "channel": "channel-id", "ts": "thread-id" }');

    const resp = await slackClient.postMessage('ADOBE_INTERNAL', {
      channel: 'channel-id',
      blocks,
      text,
      ts: 'thread-id',
    });
    expect(resp.channelId).to.equal('channel-id');
    expect(resp.threadId).to.equal('thread-id');
  });

  it('returns an error message when api returns unsuccessful', async () => {
    const slackClient = SlackClient.createFrom(context);
    nock('https://slack.com', {
      reqheaders: {
        authorization: `Bearer ${context.env.SLACK_TOKEN_ADOBE_INTERNAL}`,
      },
    })
      .post('/api/chat.postMessage', {
        unfurl_links: false,
        unfurl_media: false,
        channel: 'channel-id',
        blocks: JSON.stringify(blocks),
        text,
        ts: 'thread-id',
      })
      .reply(200, '{ "ok": false, "error": "meh" }');

    await expect(slackClient.postMessage('ADOBE_INTERNAL', {
      channel: 'channel-id',
      blocks,
      text,
      ts: 'thread-id',
    })).to.be.rejectedWith('An API error occurred: meh');
  });

  it('test using slack block builder', async () => {
    const slackClient = SlackClient.createFrom(context);

    const channel = 'channel-id';
    const thread = 'thread-id';

    const opts = Message()
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
        unfurl_links: false,
        unfurl_media: false,
        ...opts,
        blocks: JSON.stringify(opts.blocks),
      })
      .reply(200, '{ "ok": true, "channel": "channel-id", "ts": "thread-id" }');

    const resp = await slackClient.postMessage('ADOBE_INTERNAL', opts);
    expect(resp.channelId).to.equal('channel-id');
    expect(resp.threadId).to.equal('thread-id');
  });
});
