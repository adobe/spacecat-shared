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

/**
 * Represents a Slack team
 */
export default class SlackTeam {
  /**
   * Creates a new Slack team
   *
   * @param {object} teamData - team data
   * @param {string} teamData.id - team id
   * @param {string} teamData.name - team name
   * @param {string} teamData.url - team url
   * @param {string} teamData.domain - team domain
   * @param {string} teamData.enterprise_id - team enterprise id
   * @constructor
   */
  constructor(teamData) {
    this.id = teamData.id;
    this.name = teamData.name;
    this.url = teamData.url;
    this.domain = teamData.domain;
    this.enterpriseId = teamData.enterprise_id;
  }

  static create(teamData) {
    return new SlackTeam(teamData);
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getURL() {
    return this.url;
  }

  getDomain() {
    return this.domain;
  }

  isEnterprise() {
    return hasText(this.enterpriseId);
  }
}
