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
import { WebClient } from '@slack/web-api';

const ENV_PREFIX = 'SLACK_TOKEN_';

export const SLACK_TARGETS = {
  ADOBE_INTERNAL: 'ADOBE_INTERNAL',
  ADOBE_EXTERNAL: 'ADOBE_EXTERNAL',
};

const DEFAULT_PARAMS = {
  unfurl_links: false,
  unfurl_media: false,
};

function getEnvironmentVariableNameForTarget(target) {
  return `${ENV_PREFIX}${target}`;
}

export class SlackClient {
  static createFrom(context) {
    if (context.slackClient) return context.slackClient;

    const expected = Object.values(SLACK_TARGETS)
      .map((target) => getEnvironmentVariableNameForTarget(target));

    const targetTokenPairs = Object.keys(context.env)
      .filter((variable) => expected.includes(variable))
      .map((variable) => ({
        target: variable.slice(ENV_PREFIX.length),
        token: context.env[variable],
      }));

    const slackClient = new SlackClient(targetTokenPairs, context.log);
    context.slackClient = slackClient;
    return slackClient;
  }

  constructor(targetTokenPairs, log) {
    if (!Array.isArray(targetTokenPairs)) {
      throw Error('targetTokenPairs parameter should be an array');
    }

    if (targetTokenPairs.length === 0) {
      throw Error('No environment variable containing a slack token found');
    }

    this.clients = targetTokenPairs
      .reduce((acc, { target, token }) => {
        acc[target] = new WebClient(token);
        return acc;
      }, {});
    this.log = log;
  }

  #getClient(target) {
    if (!this.clients[target]) {
      throw new Error(`Environment variable '${getEnvironmentVariableNameForTarget(target)}' does not exist. Slack Client could not be initialized.`);
    }
    return this.clients[target];
  }

  async postMessage(target, opts) {
    const client = this.#getClient(target);
    try {
      const result = await client.chat.postMessage({
        ...DEFAULT_PARAMS,
        ...opts,
      });

      return {
        channelId: result.channel,
        threadId: result.ts,
      };
    } catch (error) {
      this.log.error(`Slack message failed to send to ${target}`, error);
      throw error;
    }
  }
}
