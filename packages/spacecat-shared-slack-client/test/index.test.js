/*
 * Copyright 2023 Adobe. All rights reserved.
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
import createFrom, { SLACK_TARGETS } from '../src/index.js';
import BaseSlackClient from '../src/clients/base-slack-client.js';
import ElevatedSlackClient from '../src/clients/elevated-slack-client.js';

describe('Factory', () => {
  let context;
  const mockToken = 'mock-token';
  const mockLog = { info: () => {} };

  beforeEach(() => {
    context = {
      env: {
        SLACK_TOKEN_ADOBE_INTERNAL: mockToken,
        SLACK_TOKEN_ADOBE_EXTERNAL: mockToken,
        SLACK_TOKEN_ADOBE_INTERNAL_ELEVATED: mockToken,
        SLACK_TOKEN_ADOBE_EXTERNAL_ELEVATED: mockToken,
        SLACK_OPS_CHANNEL_ADOBE_INTERNAL: 'mock-channel',
        SLACK_OPS_CHANNEL_ADOBE_EXTERNAL: 'mock-channel',
        SLACK_OPS_ADMINS_ADOBE_INTERNAL: 'mock-admin',
        SLACK_OPS_ADMINS_ADOBE_EXTERNAL: 'mock-admin',
      },
      slackClients: {},
      log: mockLog,
    };
  });

  it('creates a BaseSlackClient for non-elevated targets', () => {
    const client = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    expect(client).to.be.instanceOf(BaseSlackClient);
  });

  it('creates a client if context.slackClients is undefined', () => {
    delete context.slackClients;
    const client = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    expect(client).to.be.instanceOf(BaseSlackClient);
  });

  it('creates an ElevatedSlackClient for elevated targets', () => {
    const client = createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL, true);
    expect(client).to.be.instanceOf(ElevatedSlackClient);
  });

  it('throws an error if target is missing', () => {
    expect(() => createFrom(context, '', false)).to.throw('Missing target for the Slack Client');
  });

  it('throws an error if Slack token is not set', () => {
    context.env = {};
    expect(() => createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false)).to.throw('No Slack token set for ADOBE_INTERNAL');
    expect(() => createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, true)).to.throw('No Slack token set for ADOBE_INTERNAL with elevated privileges');
  });

  it('throws an error if Ops Channel ID is not set', () => {
    context.env.SLACK_OPS_CHANNEL_ADOBE_INTERNAL = '';
    context.env.SLACK_OPS_ADMINS_ADOBE_INTERNAL = undefined;
    expect(() => createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false)).to.throw('No Ops Channel ID set for ADOBE_INTERNAL');
    expect(() => createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, true)).to.throw('No Ops Channel ID set for ADOBE_INTERNAL');
  });

  it('reuses existing client instances for the same target', () => {
    const client1 = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    const client2 = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    expect(client1).to.equal(client2);
  });

  it('does not reuse client instances for different targets', () => {
    const client1 = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    const client2 = createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL, false);
    expect(client1).to.not.equal(client2);
  });

  it('does not reuse client instances for different elevation statuses', () => {
    const client1 = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, false);
    const client2 = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL, true);
    expect(client1).to.not.equal(client2);
  });
});
