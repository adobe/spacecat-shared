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
  constructor(token, log) {
    this.client = new WebClient(token);
    this.log = log;
  }

  async #apiCall(method, message) {
    try {
      return await this.client.apiCall(method, message);
    } catch (e) {
      this.log.error(`Failed to perform slack api call: ${method}`, e);
      throw e;
    }
  }

  async postMessage(message) {
    const result = await this.#apiCall('chat.postMessage', message);
    return {
      channelId: result.channel,
      threadId: result.ts,
    };
  }

  async fileUpload(file) {
    const result = await this.#apiCall('files.uploadV2', file);

    if (result.files.length === 0) {
      throw new Error(`File upload was unsuccessful. Filename was "${file.filename}"`);
    }

    return {
      fileUrl: result.files[0].url_private,
      channels: result.files[0].channels,
    };
  }
}
