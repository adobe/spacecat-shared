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
import { hasText, isObject } from '@adobe/spacecat-shared-utils';

import BaseSlackClient from './clients/base-slack-client.js';
import ElevatedSlackClient from './clients/elevated-slack-client.js';

const ENV_PREFIX = 'SLACK_TOKEN_';

export const SLACK_TARGETS = {
  ADOBE_INTERNAL: 'ADOBE_INTERNAL',
  ADOBE_EXTERNAL: 'ADOBE_EXTERNAL',
};

function getEnvironmentVariableNameForTarget(target, isElevated = false) {
  return `${ENV_PREFIX}${target}${isElevated ? '_ELEVATED' : ''}`;
}

function getToken(context, target, isElevated) {
  const token = context.env[getEnvironmentVariableNameForTarget(target, isElevated)];
  if (!hasText(token)) {
    throw new Error(`No Slack token set for ${target}${isElevated ? ' with elevated privileges' : ''}`);
  }
  return token;
}

const createFrom = (context, target, isElevated = false) => {
  const { log } = context;

  if (!hasText(target)) {
    throw new Error('Missing target for the Slack Client');
  }

  if (!isObject(context.slackClients)) {
    context.slackClients = {};
  }

  const clientKey = `${target}_${isElevated ? 'ELEVATED' : 'STANDARD'}`;

  if (!context.slackClients[clientKey]) {
    const token = getToken(context, target, isElevated);
    const ClientClass = isElevated ? ElevatedSlackClient : BaseSlackClient;
    context.slackClients[clientKey] = new ClientClass(token, log);
  }

  return context.slackClients[clientKey];
};

export default createFrom;
