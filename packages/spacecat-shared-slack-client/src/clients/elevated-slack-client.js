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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseSlackClient from './base-slack-client.js';

export default class ElevatedSlackClient extends BaseSlackClient {
  constructor(token, log) {
    super(token, log);
    this.log = log;
  }

  /**
   * Retrieves the team information for the workspace.
   * Required scopes: team:read
   * @private This method is private and should not be called directly.
   * @return {Promise<Object>} The team information.
   */
  async #getTeam() {
    try {
      const response = await this._apiCall('team.info');
      return response.team;
    } catch (e) {
      this.log.error('Failed to retrieve workspace information', e);
      throw e;
    }
  }

  /**
   * Initializes the Slack client. This method must be called before any other method.
   * @private This method is private and should not be called directly.
   * @return {Promise<void>} A promise that resolves when the client is initialized.
   */
  async #initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.team = await this.#getTeam();
      this.isEnterprise = hasText(this.team.enterprise_id);
      this.isInitialized = true;
    } catch (e) {
      this.log.error('Failed to initialize Slack client', e);
      throw e;
    }
  }
}
