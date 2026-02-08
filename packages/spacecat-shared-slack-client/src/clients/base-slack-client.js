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
import { hasText, isObject } from '@adobe/spacecat-shared-utils';

const ENV_PREFIX = 'SLACK_TOKEN_';

function getEnvironmentVariableNameForTarget(target, isElevated = false) {
  return `${ENV_PREFIX}${target}${isElevated ? '_ELEVATED' : ''}`;
}

function getOpsConfig(context, target) {
  const opsChannelId = context.env[`SLACK_OPS_CHANNEL_${target}`];
  const admins = (context.env[`SLACK_OPS_ADMINS_${target}`] || '')
    .split(',')
    .filter((admin) => hasText(admin));

  if (!hasText(opsChannelId)) {
    throw new Error(`No Ops Channel ID set for ${target}`);
  }

  return { opsChannelId, admins };
}

function getToken(context, target, isElevated) {
  const token = context.env[getEnvironmentVariableNameForTarget(target, isElevated)];
  if (!hasText(token)) {
    throw new Error(`No Slack token set for ${target}${isElevated ? ' with elevated privileges' : ''}`);
  }
  return token;
}

export default class BaseSlackClient {
  static createFrom(context, target) {
    return this._internalCreateFrom(context, BaseSlackClient, target);
  }

  static _internalCreateFrom(
    context,
    ClientClass,
    target,
    isElevated = false,
  ) {
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
      const opsConfig = getOpsConfig(context, target);
      context.slackClients[clientKey] = new ClientClass(token, opsConfig, log);
    }

    return context.slackClients[clientKey];
  }

  /**
   * Creates a new Slack client
   *
   * @param {string} token - Slack token
   * @param {object} opsConfig The ops configuration.
   * @param {string} opsConfig.opsChannelId The ID of the ops channel.
   * @param {string[]} opsConfig.admins The list of admin user IDs.
   * @param {object} log - log
   */
  constructor(token, opsConfig, log) {
    this.client = new WebClient(token);
    this.log = log;
    this.opsConfig = opsConfig;
  }

  _logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    if (this.log && typeof this.log.info === 'function') {
      this.log.info(`${message}: took ${duration}ms`);
    }
  }

  async _apiCall(method, message) {
    const startTime = process.hrtime.bigint();
    try {
      const result = await this.client.apiCall(method, message);
      this._logDuration(`API call ${method}`, startTime);
      return result;
    } catch (error) {
      if (this.log && typeof this.log.error === 'function') {
        this.log.error(`API call ${method} failed`, error);
      }
      throw error;
    }
  }

  async postMessage(message) {
    const result = await this._apiCall('chat.postMessage', message);
    return {
      channelId: result.channel,
      threadId: result.ts,
    };
  }

  async fileUpload(file) {
    const result = await this._apiCall('files.uploadV2', file);

    if (result.files.length === 0) {
      throw new Error(`File upload was unsuccessful. Filename was "${file.filename}"`);
    }

    return {
      fileUrl: result.files[0].url_private,
      channels: result.files[0].channels,
    };
  }
}
