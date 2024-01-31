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

export default class BaseSlackClient {
  /**
   * Creates a new Slack client
   *
   * @param {string} token - Slack token
   * @param {object} opsConfig The ops configuration.
   * @param {string} opsConfig.opsChannelId The ID of the ops channel.
   * @param {string[]} opsConfig.admins The list of admin user IDs.
   * @param {object} log - logger
   */
  constructor(token, opsConfig, log) {
    this.client = new WebClient(token);
    this.log = log;
    this.opsConfig = opsConfig;
  }

  _logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  async _apiCall(method, message) {
    const startTime = process.hrtime.bigint();
    const result = await this.client.apiCall(method, message);

    this._logDuration(`API call ${method}`, startTime);

    return result;
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
