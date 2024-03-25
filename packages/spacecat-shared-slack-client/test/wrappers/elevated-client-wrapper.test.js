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
import {
  elevatedSlackClientWrapper,
} from '../../src/wrappers/elevated-client-wrapper.js';
import { SLACK_TARGETS } from '../../src/index.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('Elevated Slack client action wrapper', () => {
  let exampleHandler;
  const baseEnv = {
    SLACK_OPS_CHANNEL_WORKSPACE_EXTERNAL: 'mock-external-channel',
    SLACK_TOKEN_WORKSPACE_INTERNAL_ELEVATED: 'mock-elevated-internal-token',
    SLACK_TOKEN_WORKSPACE_EXTERNAL_ELEVATED: 'mock-elevated-external-token',
  };

  beforeEach(() => {
    exampleHandler = sinon.spy(async () => new Response());
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should add an ElevatedSlackClient to context', async () => {
    const opts = { slackTarget: SLACK_TARGETS.WORKSPACE_EXTERNAL };
    await elevatedSlackClientWrapper(exampleHandler, opts)({}, { env: baseEnv });

    expect(exampleHandler.calledOnce).to.be.true;
    expect(exampleHandler.calledWith(sinon.match.any, sinon.match.has('slack'))).to.be.true;
    expect(exampleHandler.calledWith(sinon.match.any, sinon.match.hasNested('slack.elevatedClient'))).to.be.true;
    expect(exampleHandler.calledWith(sinon.match.any, sinon.match.hasNested('slack.elevatedClient.inviteUsersByEmail'))).to.be.true;
  });

  it('should not overwrite an existing ElevatedSlackClient', async () => {
    let handlerWasChecked = false;

    const opts = { slackTarget: SLACK_TARGETS.WORKSPACE_INTERNAL };
    const baseContext = {
      slack: { elevatedClient: 'existing' },
      env: baseEnv,
    };
    await elevatedSlackClientWrapper(async (_, context) => {
      expect(context.slack.elevatedClient).to.equal('existing');
      handlerWasChecked = true;
    }, opts)({}, baseContext);

    expect(handlerWasChecked).to.be.true;
  });

  it('should throw an error if slackTarget is omitted from opts', async () => {
    await expect(elevatedSlackClientWrapper(exampleHandler)({}, { env: baseEnv }))
      .to.be.rejectedWith('Missing target for the Slack Client');
  });
});
